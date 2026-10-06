import logging
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.time import ist_now, to_naive_ist
from app.models import Donation, DonationStatus
from app.matching.service import run_matching

router = APIRouter(prefix="/api/v1/cron", tags=["cron"])
logger = logging.getLogger(__name__)

@router.get("/rematch")
async def run_rematch_cron(db: Annotated[AsyncSession, Depends(get_db)]):
    """
    Vercel cron endpoint.
    1. Finds all AVAILABLE and NO_MATCH_FOUND donations.
    2. If expiry_time < now, updates status to EXPIRED.
    3. Else, re-runs the matching algorithm.
    """
    logger.info("Starting scheduled rematch cron job.")
    
    # 1. Fetch eligible donations
    # We include MATCHING as well, just in case a previous run crashed leaving it stuck
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
    # expiry_time is naive IST in the database
    naive_now = to_naive_ist(now)
    
    expired_count = 0
    rematched_count = 0

    for donation in donations:
        # Check expiration
        if donation.expiry_time and donation.expiry_time <= naive_now:
            donation.status = DonationStatus.EXPIRED
            donation.updated_at = now
            expired_count += 1
            # Broadcast the expiry? We can optionally do that if needed
        else:
            # We can re-trigger matching directly.
            # run_matching creates its own DB session, so we don't pass the current one
            try:
                await run_matching(donation.id)
                rematched_count += 1
            except Exception as e:
                logger.error(f"Error during rematch for {donation.id}: {e}")

    await db.commit()
    
    return {
        "status": "success",
        "processed": len(donations),
        "expired": expired_count,
        "rematched": rematched_count
    }
