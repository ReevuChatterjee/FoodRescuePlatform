import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models import Donation
from app.matching.service import run_matching

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
        donation = result.scalar_one_or_none()
        if donation:
            print(f"Running match for {donation.id}")
            await run_matching(donation.id)
            print("Done.")
        else:
            print("No donations found.")

if __name__ == "__main__":
    asyncio.run(run())
