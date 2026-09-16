import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import Base
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./local_dev.sqlite3")

async def init_db():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())
