import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///backend/app.db")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(text("SELECT id, status, pickup_location FROM donations ORDER BY created_at DESC LIMIT 5"))
        print("--- Recent Donations ---")
        for row in result:
            print(dict(row._mapping))
            
        result = await session.execute(text("SELECT id, status, driver_id FROM deliveries ORDER BY created_at DESC LIMIT 5"))
        print("\n--- Recent Deliveries ---")
        for row in result:
            print(dict(row._mapping))
            
        result = await session.execute(text("SELECT driver_id, current_location, capacity_kg, availability_status FROM vehicles LIMIT 5"))
        print("\n--- Vehicles ---")
        for row in result:
            print(dict(row._mapping))

asyncio.run(main())
