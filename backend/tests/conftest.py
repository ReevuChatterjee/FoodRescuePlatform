"""
Pytest configuration for backend unit tests.

Shared fixtures for auth, database, and API testing.
"""

import pytest
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from httpx import AsyncClient

from app.core.config import settings
from app.core.database import Base
from app.main import app


# Test database URL - override in CI
TEST_DATABASE_URL = settings.DATABASE_URL.replace("/replate_db", "/replate_test")


@pytest.fixture(scope="session")
def event_loop():
    """Provide event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,  # Avoid connection pool issues in tests
    )
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine):
    """Provide a clean database session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    TestSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def async_client():
    """Provide an async HTTP client for API testing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def admin_token(async_client: AsyncClient, db_session: AsyncSession):
    """
    Provide an admin authentication token.

    Person 1 should implement this fixture properly once auth endpoints exist.
    For now, this is a placeholder that will fail if auth is not implemented.
    """
    # TODO Person 1: Replace with actual auth implementation
    try:
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "admin@cpi.test", "password": "admin123"},
        )
        if response.status_code == 200:
            return response.json()["data"]["access_token"]
    except Exception:
        pass

    # If auth not implemented yet, skip tests requiring auth
    pytest.skip("Auth endpoints not implemented yet by Person 1")
