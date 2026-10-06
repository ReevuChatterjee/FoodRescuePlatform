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

from app.core.config import settings

# Supabase connection pooler (pgbouncer, port 6543) requires disabling
# statement cache. Direct Supabase connections (port 5432) work normally.
_is_pooler = ":6543" in settings.DATABASE_URL

_connect_args = {}
if _is_pooler:
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_cache_size"] = 0

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # set True in dev via env override if needed
    pool_pre_ping=True,
    # On Vercel serverless, each invocation is ephemeral — keep pool small.
    pool_size=2,
    max_overflow=5,
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
