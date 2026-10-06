"""
Async SQLAlchemy engine and session factory.

Using asyncpg driver (DATABASE_URL must be postgresql+asyncpg://...).
Alembic uses the sync DATABASE_URL_SYNC for migrations only.

Supabase note: If connecting through Supabase's connection pooler (port 6543),
asyncpg requires `statement_cache_size=0` because pgbouncer does not support
prepared statements. The direct connection (port 5432) does not need this.
We detect the pooler automatically by checking if port 6543 is used.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import NullPool

from app.core.config import settings

# Supabase connection pooler (pgbouncer) requires disabling statement cache.
# We apply this universally on Vercel to avoid connection errors regardless of URL format.
_connect_args = {
    "statement_cache_size": 0,
}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # set True in dev via env override if needed
    poolclass=NullPool,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields a DB session and guarantees close."""
    async with AsyncSessionLocal() as session:
        yield session
