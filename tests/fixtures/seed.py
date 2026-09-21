"""
Integration test fixtures — seeded test data.

Per [orig §29]: fixed seeded IDs so assertions can hard-code expected deltas.
All fixtures return IDs that tests can reference.
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings
from app.core.database import Base
from app.models import (
    User, Donor, NGO, Donation, Vehicle, Delivery, HandoverRecord,
    NGOFoodCategory, UserRole, DonationStatus, NGOVerificationStatus,
    DeliveryStatus,
)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test database URL — override in CI
TEST_DATABASE_URL = settings.DATABASE_URL.replace("/replate_db", "/replate_test")

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    """Provide event loop for async tests."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session():
    """Provide a clean database session for each test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def seed_users(db_session: AsyncSession):
    """Seed test users: admin, donor, NGO, driver."""
    users = [
        User(
            id="admin_001",
            name="Admin User",
            email="admin@cpi.test",
            phone="+919999999999",
            password_hash=pwd_context.hash("admin123"),
            role=UserRole.ADMIN,
            created_at=datetime.utcnow(),
        ),
        User(
            id="donor_001",
            name="Test Donor",
            email="donor@cpi.test",
            phone="+919999999998",
            password_hash=pwd_context.hash("donor123"),
            role=UserRole.DONOR,
            created_at=datetime.utcnow(),
        ),
        User(
            id="ngo_001",
            name="NGO User A",
            email="ngoa@cpi.test",
            phone="+919999999997",
            password_hash=pwd_context.hash("ngo123"),
            role=UserRole.NGO,
            created_at=datetime.utcnow(),
        ),
        User(
            id="ngo_002",
            name="NGO User B",
            email="ngob@cpi.test",
            phone="+919999999996",
            password_hash=pwd_context.hash("ngo123"),
            role=UserRole.NGO,
            created_at=datetime.utcnow(),
        ),
        User(
            id="driver_001",
            name="Test Driver",
            email="driver@cpi.test",
            phone="+919999999995",
            password_hash=pwd_context.hash("driver123"),
            role=UserRole.DRIVER,
            created_at=datetime.utcnow(),
        ),
    ]
    for user in users:
        db_session.add(user)
    await db_session.commit()
    return {u.id: u for u in users}


@pytest.fixture
async def seed_donors(db_session: AsyncSession, seed_users):
    """Seed test donor."""
    donor = Donor(
        id="donor_001",
        user_id="donor_001",
        organisation_name="Test Restaurant",
        address="123 Test Street, Bengaluru",
        location="12.9716,77.5946",  # PostGIS POINT in production
        contact_person="Test Contact",
        verification_status="VERIFIED",
        daily_waste_category="STANDARD",
        created_at=datetime.utcnow(),
    )
    db_session.add(donor)
    await db_session.commit()
    return donor


@pytest.fixture
async def seed_ngos(db_session: AsyncSession, seed_users):
    """Seed three test NGOs with varying capacity/categories."""
    ngos = [
        NGO(
            id="ngo_001",
            user_id="ngo_001",
            organisation_name="Food Bank A",
            address="456 NGO Street, Bengaluru",
            location="12.9345,77.6104",
            storage_capacity_kg=100.0,
            available_capacity_kg=50.0,
            operating_start="08:00",
            operating_end="20:00",
            verification_status=NGOVerificationStatus.APPROVED,
            created_at=datetime.utcnow(),
        ),
        NGO(
            id="ngo_002",
            user_id="ngo_002",
            organisation_name="Food Bank B",
            address="789 NGO Avenue, Bengaluru",
            location="12.9352,77.6245",
            storage_capacity_kg=50.0,
            available_capacity_kg=20.0,  # low capacity for rejection test
            operating_start="08:00",
            operating_end="20:00",
            verification_status=NGOVerificationStatus.APPROVED,
            created_at=datetime.utcnow(),
        ),
        NGO(
            id="ngo_003",
            user_id="ngo_001",  # reuse ngo_001 user
            organisation_name="Food Bank C",
            address="999 NGO Road, Bengaluru",
            location="12.9716,77.5946",
            storage_capacity_kg=200.0,
            available_capacity_kg=150.0,
            operating_start="08:00",
            operating_end="20:00",
            verification_status=NGOVerificationStatus.APPROVED,
            created_at=datetime.utcnow(),
        ),
    ]
    for ngo in ngos:
        db_session.add(ngo)

    # NGO food categories
    categories = [
        NGOFoodCategory(ngo_id="ngo_001", food_category="COOKED", accepted=True),
        NGOFoodCategory(ngo_id="ngo_001", food_category="PACKAGED", accepted=True),
        NGOFoodCategory(ngo_id="ngo_002", food_category="PACKAGED", accepted=True),  # COOKED not accepted
        NGOFoodCategory(ngo_id="ngo_003", food_category="COOKED", accepted=True),
    ]
    for cat in categories:
        db_session.add(cat)

    await db_session.commit()
    return {n.id: n for n in ngos}


@pytest.fixture
async def seed_vehicles(db_session: AsyncSession, seed_users):
    """Seed test vehicle/driver."""
    vehicle = Vehicle(
        id="vehicle_001",
        driver_id="driver_001",
        capacity_kg=50.0,
        current_location="12.9716,77.5946",
        availability_status="AVAILABLE",
    )
    db_session.add(vehicle)
    await db_session.commit()
    return vehicle


@pytest.fixture
async def seed_donation(db_session: AsyncSession, seed_donors):
    """Seed a test donation for matching tests."""
    donation = Donation(
        id="don_001",
        donor_id="donor_001",
        food_category="COOKED",
        food_name="Vegetable Rice",
        quantity_kg=35.0,
        prepared_at=datetime.utcnow() - timedelta(hours=2),
        available_from=datetime.utcnow() - timedelta(hours=1),
        expiry_time=datetime.utcnow() + timedelta(hours=3),  # 3 hours remaining
        pickup_location="12.9716,77.5946",
        special_requirements="Keep refrigerated below 5°C",
        status=DonationStatus.AVAILABLE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db_session.add(donation)
    await db_session.commit()
    return donation
