import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models import User, UserRole, Donor, Donation
import app.core.config as config

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///./local_dev.sqlite3", echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "test2@test.com"))
        user = result.scalar_one_or_none()
        print("User role is:", type(user.role), user.role)
        print("Comparison:", user.role == UserRole.DONOR)
        print("Comparison str:", user.role == "DONOR")

asyncio.run(main())
