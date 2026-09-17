import asyncio
from app.core.database import AsyncSessionLocal
from app.services.matching_service import load_donation, load_active_ngos, load_routes, load_active_weights
from app.matching_engine import match
from datetime import datetime, timezone
from sqlalchemy import select
from app.models import Donation, DonationStatus
from app.matching.service import run_matching

async def run():
    async with AsyncSessionLocal() as db:
        # First reset it to available so it matches
        result = await db.execute(select(Donation).where(Donation.id == 'don_5511efc054'))
        d = result.scalar_one_or_none()
        d.status = DonationStatus.AVAILABLE
        await db.commit()

        engine_donation = await load_donation('don_5511efc054', db)
        ngos = await load_active_ngos(db)
        routes = load_routes(engine_donation, ngos)
        weights = await load_active_weights(engine_donation, db)

        match_result = match(
            donation=engine_donation,
            ngos=ngos,
            routes=routes,
            weights=weights,
            reference_time=datetime.now(timezone.utc),
        )

        print(f"Matches: {match_result.matches}")
        print(f"Rejections: {match_result.rejections}")

    # Now run actual matching
    await run_matching('don_5511efc054')

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Donation).where(Donation.id == 'don_5511efc054'))
        d = result.scalar_one_or_none()
        print(f"Status is now: {d.status.value}")
        print(f"Matched NGO: {d.matched_ngo_id}")

if __name__ == "__main__":
    asyncio.run(run())
