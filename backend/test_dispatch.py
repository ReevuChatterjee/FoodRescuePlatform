import asyncio
from app.core.database import AsyncSessionLocal
from app.dispatch.service import dispatch_donation

async def run():
    async with AsyncSessionLocal() as db:
        outcome = await dispatch_donation(db, "don_7a66201044")
        print(f"Status: {outcome.status}")
        print(f"Reason: {outcome.reason}")
        print(f"Driver Rejections: {outcome.driver_rejections}")
        print(f"Delivery: {outcome.delivery}")

if __name__ == "__main__":
    asyncio.run(run())
