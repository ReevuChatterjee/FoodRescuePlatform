"""
ORM models for all core tables.

Person 1 owns these schemas; Person 6 reads them for analytics.
Models match the data model in the project description PDF exactly.
"""

from app.core.time import ist_now
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    DONOR = "DONOR"
    NGO = "NGO"
    DRIVER = "DRIVER"
    ADMIN = "ADMIN"


class DonationStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    MATCHING = "MATCHING"
    MATCHED = "MATCHED"
    ACCEPTED = "ACCEPTED"
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED"
    PICKUP_STARTED = "PICKUP_STARTED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED"
    NO_MATCH_FOUND = "NO_MATCH_FOUND"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    DRIVER_ISSUE = "DRIVER_ISSUE"


class NGOVerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DeliveryStatus(str, enum.Enum):
    DRIVER_ASSIGNED = "DRIVER_ASSIGNED"
    PICKUP_STARTED = "PICKUP_STARTED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED"
    CANCELLED = "CANCELLED"
    DRIVER_ISSUE = "DRIVER_ISSUE"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class Donor(Base):
    __tablename__ = "donors"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    organisation_name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(200))  # PostGIS POINT in production
    contact_person: Mapped[str] = mapped_column(String(200))
    verification_status: Mapped[str] = mapped_column(String(50))
    daily_waste_category: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class NGO(Base):
    __tablename__ = "ngos"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    organisation_name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(200))  # PostGIS POINT in production
    storage_capacity_kg: Mapped[float] = mapped_column(Float)
    available_capacity_kg: Mapped[float] = mapped_column(Float)
    operating_start: Mapped[str] = mapped_column(String(10))  # e.g. "08:00"
    operating_end: Mapped[str] = mapped_column(String(10))    # e.g. "20:00"
    verification_status: Mapped[NGOVerificationStatus] = mapped_column(
        Enum(NGOVerificationStatus), default=NGOVerificationStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class NGOFoodCategory(Base):
    __tablename__ = "ngo_food_categories"

    ngo_id: Mapped[str] = mapped_column(ForeignKey("ngos.id"), primary_key=True)
    food_category: Mapped[str] = mapped_column(String(50), primary_key=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)


class NGODemand(Base):
    __tablename__ = "ngo_demand"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ngo_id: Mapped[str] = mapped_column(ForeignKey("ngos.id"), index=True)
    food_category: Mapped[str] = mapped_column(String(50))
    required_quantity_kg: Mapped[float] = mapped_column(Float)
    priority: Mapped[str] = mapped_column(String(20))  # LOW, MEDIUM, HIGH, CRITICAL
    valid_until: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    donor_id: Mapped[str] = mapped_column(ForeignKey("donors.id"), index=True)
    food_category: Mapped[str] = mapped_column(String(50), index=True)
    food_name: Mapped[str] = mapped_column(String(200))
    quantity_kg: Mapped[float] = mapped_column(Float)
    prepared_at: Mapped[datetime] = mapped_column(DateTime)
    available_from: Mapped[datetime] = mapped_column(DateTime)
    expiry_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    # JSON {"latitude": ..., "longitude": ..., "address": ...} per §3 POST /donations shape.
    # PostGIS POINT column can replace this later for spatial queries without changing the API.
    pickup_location: Mapped[dict] = mapped_column(JSON)
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)  # legacy, kept for back-compat
    special_handling: Mapped[str | None] = mapped_column(Text, nullable=True)  # contract field name, §3
    # JSON {"storage_temp_required", "allergen_tags", "packaging_type"} per §3
    food_safety_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[DonationStatus] = mapped_column(Enum(DonationStatus), index=True)
    matched_ngo_id: Mapped[str | None] = mapped_column(ForeignKey("ngos.id"), nullable=True, index=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    weights_version_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    driver_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    capacity_kg: Mapped[float] = mapped_column(Float)
    current_location: Mapped[str] = mapped_column(String(200))  # PostGIS POINT in production
    availability_status: Mapped[str] = mapped_column(String(50), index=True)  # AVAILABLE, BUSY, OFFLINE


class Delivery(Base):
    __tablename__ = "deliveries"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    donation_id: Mapped[str] = mapped_column(ForeignKey("donations.id"), index=True)
    ngo_id: Mapped[str] = mapped_column(ForeignKey("ngos.id"), index=True)
    driver_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    pickup_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    estimated_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_pickup_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_delivery_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    route_distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), index=True)


class HandoverRecord(Base):
    __tablename__ = "handover_records"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    donation_id: Mapped[str] = mapped_column(ForeignKey("donations.id"), index=True)
    delivery_id: Mapped[str] = mapped_column(ForeignKey("deliveries.id"), index=True)
    donor_confirmation: Mapped[bool] = mapped_column(Boolean)
    ngo_confirmation: Mapped[bool] = mapped_column(Boolean)
    pickup_timestamp: Mapped[datetime] = mapped_column(DateTime)
    delivery_timestamp: Mapped[datetime] = mapped_column(DateTime)
    quantity_handed_over: Mapped[float] = mapped_column(Float)  # distinct from donation.quantity_kg per [orig §7.3]
    donor_signature: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recipient_signature: Mapped[str | None] = mapped_column(String(500), nullable=True)
    disclaimer_version: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class NGOVerificationDocument(Base):
    __tablename__ = "ngo_verification_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ngo_id: Mapped[str] = mapped_column(ForeignKey("ngos.id"), index=True)
    document_type: Mapped[str] = mapped_column(String(100))  # "REGISTRATION_CERTIFICATE", "FSSAI_ALLIANCE_ID", etc.
    file_url: Mapped[str] = mapped_column(String(500))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True)
    entity_id: Mapped[str] = mapped_column(String(50), index=True)
    event_type: Mapped[str] = mapped_column(String(100))
    payload: Mapped[dict] = mapped_column(JSON)
    record_hash: Mapped[str] = mapped_column(String(64))
    previous_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now, index=True)


class MatchingWeightsHistory(Base):
    """Versioned scoring weights for the matching engine (Person 4).

    Keyed by city + food_category so the algorithm can be tuned per region
    and per food type without touching source code. The matching service
    looks up the active row for the donation's city + food_category and
    falls back to the 'default' city row when no specific row exists.
    """
    __tablename__ = "matching_weights_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    weights_version_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    food_category: Mapped[str] = mapped_column(String(50), index=True)
    w_capacity: Mapped[float] = mapped_column(Float)
    w_shelf_life: Mapped[float] = mapped_column(Float)
    w_transit: Mapped[float] = mapped_column(Float)
    w_demand: Mapped[float] = mapped_column(Float)
    w_route: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)


class DonationRejection(Base):
    """Records each NGO rejection of a donation offer.

    Person 1's matching service accumulates these rows per donation_id and
    passes the resulting excluded_ngo_ids set to matching_engine.rematch()
    on every subsequent POST /matching/{donation_id}/reject call.
    """
    __tablename__ = "donation_rejections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    donation_id: Mapped[str] = mapped_column(ForeignKey("donations.id"), index=True)
    ngo_id: Mapped[str] = mapped_column(ForeignKey("ngos.id"), index=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rejected_at: Mapped[datetime] = mapped_column(DateTime, default=ist_now)
