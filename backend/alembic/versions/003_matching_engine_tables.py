"""003 matching engine tables

Revision ID: 003_matching_engine
Revises: 002
Create Date: 2026-09-16

Creates:
  - matching_weights_history: versioned w1..w5 scoring weights per city + food_category
  - donation_rejections:      per-donation NGO rejection log for rematching

Also seeds a fallback 'wv_default_v1' row so matching_service.py always
finds at least one active weights row even before any city-specific tuning.
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "003_matching_engine"
down_revision = "002_donation_contract_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # matching_weights_history
    op.create_table(
        "matching_weights_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("weights_version_id", sa.String(length=100), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("food_category", sa.String(length=50), nullable=False),
        sa.Column("w_capacity", sa.Float(), nullable=False),
        sa.Column("w_shelf_life", sa.Float(), nullable=False),
        sa.Column("w_transit", sa.Float(), nullable=False),
        sa.Column("w_demand", sa.Float(), nullable=False),
        sa.Column("w_route", sa.Float(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("weights_version_id", name="uq_weights_version_id"),
    )
    op.create_index("ix_matching_weights_history_city", "matching_weights_history", ["city"])
    op.create_index("ix_matching_weights_history_food_category", "matching_weights_history", ["food_category"])
    op.create_index("ix_matching_weights_history_is_active", "matching_weights_history", ["is_active"])
    op.create_index("ix_matching_weights_history_weights_version_id", "matching_weights_history", ["weights_version_id"], unique=True)

    # Seed a universal fallback row: equal weights summing to exactly 1.0.
    op.execute(
        "INSERT INTO matching_weights_history "
        "(weights_version_id, city, food_category, w_capacity, w_shelf_life, w_transit, w_demand, w_route, is_active, created_at) "
        "VALUES ('wv_default_v1', 'default', 'ALL', 0.2, 0.2, 0.2, 0.2, 0.2, TRUE, CURRENT_TIMESTAMP)"
    )

    # donation_rejections
    op.create_table(
        "donation_rejections",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("donation_id", sa.String(length=50), nullable=False),
        sa.Column("ngo_id", sa.String(length=50), nullable=False),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column("rejected_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["donation_id"], ["donations.id"]),
        sa.ForeignKeyConstraint(["ngo_id"], ["ngos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_donation_rejections_donation_id", "donation_rejections", ["donation_id"])
    op.create_index("ix_donation_rejections_ngo_id", "donation_rejections", ["ngo_id"])


def downgrade() -> None:
    op.drop_table("donation_rejections")
    op.drop_table("matching_weights_history")
