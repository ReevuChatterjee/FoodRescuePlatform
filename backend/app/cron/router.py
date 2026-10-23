import logging
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.core.database import get_db
from app.core.time import IST, ist_now, to_naive_ist
from app.models import Donation, DonationStatus
from app.matching_engine import match
from app.services.matching_service import (
    load_donation,
    load_active_ngos,
    load_routes,
    load_active_weights,
    get_excluded_ngo_ids,
)
from app.ws.manager import manager

router = APIRouter(prefix="/api/v1/cron", tags=["cron"])
logger = logging.getLogger(__name__)

@router.get("/rematch")
async def run_rematch_cron(db: Annotated[AsyncSession, Depends(get_db)]):
    """
    Vercel cron endpoint.
    1. Finds all AVAILABLE, NO_MATCH_FOUND, and stuck-MATCHING donations.
    2. If expiry_time < now, updates status to EXPIRED.
    3. Else, re-runs the matching algorithm using the existing DB session
       (avoids a second connection that would conflict with NullPool on Supabase).
    """
    logger.info("Starting scheduled rematch cron job.")
    
    # 1. Fetch eligible donations
    # We include MATCHING as well, in case a previous run crashed leaving it stuck.
    result = await db.execute(
        select(Donation).where(
            Donation.status.in_([
                DonationStatus.AVAILABLE,
                DonationStatus.NO_MATCH_FOUND,
                DonationStatus.MATCHING
            ])
        )
    )
    donations = result.scalars().all()
    
    now = ist_now()
    # expiry_time is stored as naive IST in the database.
    naive_now = to_naive_ist(now)
    
    expired_count = 0
    rematched_count = 0
    error_count = 0

    for donation in donations:
        # Check expiration first (naive IST comparison, matching DB storage).
        if donation.expiry_time and donation.expiry_time <= naive_now:
            donation.status = DonationStatus.EXPIRED
            donation.updated_at = now
            expired_count += 1
            continue

        # Re-run matching inline using the existing session — do NOT call
        # run_matching() here because that opens a second AsyncSessionLocal()
        # which causes a deadlock / connection exhaustion under NullPool + pgbouncer.
        try:
            donation.status = DonationStatus.MATCHING
            donation.updated_at = now

            engine_donation = await load_donation(donation.id, db)
            if not engine_donation:
                logger.warning("Cron: could not load donation %s for matching; skipping.", donation.id)
                error_count += 1
                continue

            ngos = await load_active_ngos(db)
            routes = load_routes(engine_donation, ngos)
            weights = await load_active_weights(engine_donation, db)
            excluded = await get_excluded_ngo_ids(donation.id, db)

            match_result = match(
                donation=engine_donation,
                ngos=ngos,
                routes=routes,
                weights=weights,
                reference_time=max(datetime.now(IST), engine_donation.available_from),
                excluded_ngo_ids=excluded if excluded else None,
            )

            if not match_result.matches:
                donation.status = DonationStatus.NO_MATCH_FOUND
                donation.updated_at = now
                await manager.broadcast("donations", {
                    "event": "donation.no_match_found",
                    "donation_id": donation.id,
                })
                logger.info("Cron: no match found for donation %s.", donation.id)
            else:
                best = match_result.matches[0]
                donation.status = DonationStatus.MATCHED
                donation.matched_ngo_id = best.ngo_id
                donation.match_score = best.score
                donation.match_breakdown = {
                    "capacity_score": best.capacity_score,
                    "shelf_life_score": best.shelf_life_score,
                    "transit_score": best.transit_score,
                    "demand_score": best.demand_score,
                    "route_score": best.route_score,
                    "eta_minutes": best.eta_minutes,
                }
                donation.weights_version_id = match_result.weights_version_id
                donation.updated_at = now
                await manager.broadcast("donations", {
                    "event": "donation.matched",
                    "donation_id": donation.id,
                    "ngo_id": best.ngo_id,
                })
                logger.info(
                    "Cron: matched donation %s to NGO %s (score=%.3f).",
                    donation.id, best.ngo_id, best.score,
                )

            rematched_count += 1

        except Exception as e:
            logger.error("Cron: error during rematch for %s: %s", donation.id, e, exc_info=True)
            error_count += 1

    await db.commit()
    
    return {
        "status": "success",
        "processed": len(donations),
        "expired": expired_count,
        "rematched": rematched_count,
        "errors": error_count,
    }
