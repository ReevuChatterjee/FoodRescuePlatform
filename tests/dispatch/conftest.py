"""Fixtures for Person 5 dispatch/driver API tests.

Run from the repo root (Postgres + Redis up, DATABASE_URL pointing at *_test):

    PYTHONPATH=backend:. pytest -o asyncio_mode=auto tests/dispatch

Everything loop-bound is created per test: a NullPool engine (so no asyncpg
connection outlives its event loop), the Redis idempotency client, and each
request gets its own session, as in production, so row locks and background
tasks behave like the real app. Background dispatch runs use the same test
database through app.dispatch.service.AsyncSessionLocal.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.dependencies import get_current_user
from app.core import idempotency
from app.core.config import settings
from app.core.database import Base, get_db
from app.dispatch import service as dispatch_service
from app.drivers import router as drivers_router
from app.main import app
from app.models import (
    NGO,
    AuditLog,
    Delivery,
    Donation,
    DonationStatus,
    Donor,
    NGOVerificationStatus,
    User,
    UserRole,
    Vehicle,
)
from app.routing import service as routing_service
from app.ws.manager import manager

PICKUP = {"latitude": 12.9352, "longitude": 77.6245, "address": "12, MG Road"}
NGO_LOCATION = "12.934500,77.610400"
NEAR_PICKUP = "12.936000,77.625000"
TEST_REDIS_DB = 15


def _test_database_url() -> str:
    url = settings.DATABASE_URL
    if not url.split("?")[0].rstrip("/").endswith("_test"):
        pytest.exit("tests/dispatch drop every table: point DATABASE_URL at a *_test database.")
    return url


@dataclass
class World:
    sessions: async_sessionmaker[AsyncSession]
    events: list[dict[str, Any]] = field(default_factory=list)
    users: dict[str, User] = field(default_factory=dict)
    current: dict[str, User | None] = field(default_factory=lambda: {"user": None})
    clock: list[float] = field(default_factory=lambda: [1000.0])  # rate-limiter seconds

    def act_as(self, user_id: str) -> None:
        self.current["user"] = self.users[user_id]

    def advance(self, seconds: float) -> None:
        self.clock[0] += seconds

    def events_named(self, name: str) -> list[dict[str, Any]]:
        return [e for e in self.events if e["event"] == name]

    def event_names(self, channel: str | None = None) -> list[str]:
        return [e["event"] for e in self.events if channel is None or e["_channel"] == channel]

    async def get(self, model, key):
        async with self.sessions() as s:
            return await s.get(model, key)

    async def audit_types(self, entity_id: str) -> list[str]:
        async with self.sessions() as s:
            rows = await s.execute(
                select(AuditLog.event_type).where(AuditLog.entity_id == entity_id).order_by(AuditLog.id)
            )
            return list(rows.scalars())

    async def deliveries_for(self, donation_id: str) -> list[Delivery]:
        async with self.sessions() as s:
            rows = await s.execute(select(Delivery).where(Delivery.donation_id == donation_id))
            return list(rows.scalars())

    async def add(self, *rows) -> None:
        async with self.sessions() as s:
            s.add_all(rows)
            await s.commit()


def naive_utcnow() -> datetime:
    return dispatch_service.as_naive(dispatch_service.utcnow())


def make_donation(donation_id: str, quantity_kg: float = 35.0, expiry_minutes: float = 180,
                  status: DonationStatus = DonationStatus.ACCEPTED, ngo_id: str | None = "ngo_1",
                  available_in_minutes: float = 0) -> Donation:
    now = naive_utcnow()
    return Donation(
        id=donation_id, donor_id="donor_1", food_category="COOKED", food_name="Vegetable Rice",
        quantity_kg=quantity_kg, prepared_at=now - timedelta(hours=1),
        available_from=now + timedelta(minutes=available_in_minutes),
        expiry_time=now + timedelta(minutes=expiry_minutes),
        pickup_location=dict(PICKUP), special_handling="Keep refrigerated below 5°C",
        food_safety_info={"storage_temp_required": "REFRIGERATED", "allergen_tags": ["dairy"],
                          "packaging_type": "SEALED_CONTAINER"},
        status=status, matched_ngo_id=ngo_id, created_at=now, updated_at=now,
    )


def make_vehicle(driver_id: str, capacity_kg: float = 60.0, location: str | None = NEAR_PICKUP,
                 status: str = "AVAILABLE") -> Vehicle:
    return Vehicle(id=f"veh_{driver_id}", driver_id=driver_id, capacity_kg=capacity_kg,
                   current_location=location, availability_status=status)


def idem() -> dict[str, str]:
    return {"Idempotency-Key": str(uuid.uuid4())}


@pytest.fixture
async def world(monkeypatch) -> AsyncIterator[World]:
    engine = create_async_engine(_test_database_url(), poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    w = World(sessions=sessions)

    # Background dispatch runs open their own sessions: keep them on the test DB.
    monkeypatch.setattr(dispatch_service, "AsyncSessionLocal", sessions)
    routing_service.configure(None)  # heuristic provider, empty cache

    # Idempotency: fresh client on this test's loop, isolated Redis database.
    base, _, _ = settings.REDIS_URL.rpartition("/")
    monkeypatch.setattr(idempotency.settings, "REDIS_URL", f"{base}/{TEST_REDIS_DB}")
    monkeypatch.setattr(idempotency, "_redis", None)
    redis = await idempotency._get_redis()
    await redis.flushdb()

    async def record(channel: str, event: dict) -> None:
        w.events.append({"_channel": channel, **event})

    monkeypatch.setattr(manager, "broadcast", record)

    # Location rate limiter: empty per test, on a clock the test controls.
    monkeypatch.setattr(drivers_router, "_last_update_at", {})
    monkeypatch.setattr(drivers_router, "_clock", lambda: w.clock[0])

    now = naive_utcnow()
    users = [
        User(id="donor_u", name="Donor", email="donor@t.test", phone="1", password_hash="x", role=UserRole.DONOR),
        User(id="ngo_u", name="NGO", email="ngo@t.test", phone="2", password_hash="x", role=UserRole.NGO),
        User(id="drv_a", name="Driver A", email="a@t.test", phone="3", password_hash="x", role=UserRole.DRIVER),
        User(id="drv_b", name="Driver B", email="b@t.test", phone="4", password_hash="x", role=UserRole.DRIVER),
        User(id="admin_u", name="Admin", email="admin@t.test", phone="5", password_hash="x", role=UserRole.ADMIN),
    ]
    async with sessions() as s:
        s.add_all(users)
        await s.flush()
        s.add(Donor(id="donor_1", user_id="donor_u", organisation_name="Test Kitchen", address="12, MG Road",
                    location="12.9352,77.6245", contact_person="C", verification_status="VERIFIED",
                    daily_waste_category="STANDARD", created_at=now))
        s.add(NGO(id="ngo_1", user_id="ngo_u", organisation_name="Food Bank A", address="HSR Layout",
                  location=NGO_LOCATION, storage_capacity_kg=200, available_capacity_kg=150,
                  operating_start="00:00", operating_end="23:59",
                  verification_status=NGOVerificationStatus.APPROVED, created_at=now))
        await s.commit()
    w.users = {u.id: u for u in users}

    async def override_get_db():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: w.current["user"]
    try:
        yield w
    finally:
        app.dependency_overrides.clear()
        routing_service.configure(None)
        await redis.aclose()
        await engine.dispose()


@pytest.fixture
async def client(world: World) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c


async def assign(world: World, donation_id: str = "don_1", **donation_kwargs) -> dict[str, Any]:
    """Seed an accepted donation and dispatch it; returns the delivery view."""
    await world.add(make_donation(donation_id, **donation_kwargs))
    async with world.sessions() as s:
        outcome = await dispatch_service.dispatch_donation(s, donation_id)
    assert outcome.status == dispatch_service.DispatchStatus.ASSIGNED, outcome.to_dict()
    return outcome.delivery
