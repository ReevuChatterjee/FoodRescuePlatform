from app.core.time import IST
from app.core.time import ist_now
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import Donation, DonationStatus
from app.matching_engine import match, serialize_matching_result
from app.services.matching_service import (
    load_donation,
    load_active_ngos,
    load_routes,
    load_active_weights,
    get_excluded_ngo_ids,
)
from app.ws.manager import manager

logger = logging.getLogger(__name__)

async def run_matching(donation_id: str):
    """
    Background task to run the matching engine asynchronously 
    after a donation is created or when a rematch is triggered.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. Transition donation status to MATCHING
            result = await db.execute(select(Donation).where(Donation.id == donation_id).with_for_update())
            orm_donation = result.scalar_one_or_none()
            if not orm_donation or orm_donation.status not in (DonationStatus.AVAILABLE, DonationStatus.MATCHING):
                return
            
            orm_donation.status = DonationStatus.MATCHING
            orm_donation.updated_at = ist_now()
            await db.commit()
            
            await manager.broadcast("donations", {
                "event": "donation.status_changed",
                "donation_id": donation_id,
                "status": DonationStatus.MATCHING.value,
            })

            # 2. Run the matching algorithm
            engine_donation = await load_donation(donation_id, db)
            if not engine_donation:
                return

            ngos = await load_active_ngos(db)
            routes = load_routes(engine_donation, ngos)
            weights = await load_active_weights(engine_donation, db)
            excluded = await get_excluded_ngo_ids(donation_id, db)

            match_result = match(
                donation=engine_donation,
                ngos=ngos,
                routes=routes,
                weights=weights,
                reference_time=datetime.now(IST),
                excluded_ngo_ids=excluded if excluded else None,
            )

            # 3. Transition based on match results
            # We need to re-fetch/lock the donation to safely transition
            result = await db.execute(select(Donation).where(Donation.id == donation_id).with_for_update())
            orm_donation = result.scalar_one_or_none()
            if not orm_donation:
                return

            if not match_result.matches:
                orm_donation.status = DonationStatus.NO_MATCH_FOUND
                orm_donation.updated_at = ist_now()
                await db.commit()
                await manager.broadcast("donations", {
                    "event": "donation.no_match_found",
                    "donation_id": donation_id,
                })
            else:
                orm_donation.status = DonationStatus.MATCHED
                orm_donation.matched_ngo_id = match_result.matches[0].ngo_id
                orm_donation.match_score = match_result.matches[0].score
                orm_donation.weights_version_id = match_result.weights_version_id
                orm_donation.updated_at = ist_now()
                await db.commit()
                await manager.broadcast("donations", {
                    "event": "donation.matched",
                    "donation_id": donation_id,
                    "ngo_id": match_result.matches[0].ngo_id,
                })
                
        except Exception as e:
            logger.error(f"Error in run_matching for {donation_id}: {e}", exc_info=True)
            await db.rollback()
