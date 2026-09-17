import asyncio
from app.core.database import AsyncSessionLocal
from app.models import Donation
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Donation).order_by(Donation.created_at.desc()).limit(1))
        donation = result.scalar_one_or_none()
        if donation:
            print(f"Latest Donation ID: {donation.id}")
            print(f"Status: {donation.status.value}")
            print(f"Matched NGO: {donation.matched_ngo_id}")
            print(f"Match Score: {donation.match_score}")
        else:
            print("No donations found.")

if __name__ == "__main__":
    asyncio.run(check())
