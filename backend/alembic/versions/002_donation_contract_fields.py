"""Align donations table with the frozen POST /donations contract shape (§3).

Changes (Person 1, per the cross-person freeze rule in §8):
  - pickup_location: String(200) "lat,lng" -> JSON {"latitude","longitude","address"}
    so the field actually matches what §3 says Person 2 posts and Person 4 reads.
  - special_handling: new Text column, the field name the contract actually uses
    (special_requirements is kept, unused going forward, for backward compatibility
    with anything already written against 001).
  - food_safety_info: new JSON column for
    {"storage_temp_required", "allergen_tags", "packaging_type"}.

Revision ID: 002_donation_contract_fields
Revises: 001_initial_schema
Create Date: 2026-09-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_donation_contract_fields"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("special_handling", sa.Text, nullable=True))
    op.add_column("donations", sa.Column("food_safety_info", sa.JSON, nullable=True))

    # pickup_location: String -> JSONB. Existing "lat,lng" strings (if any) are
    # wrapped into {"raw": "<old value>"} so the migration never silently drops data.
    op.add_column("donations", sa.Column("pickup_location_new", sa.JSON, nullable=True))
    op.execute(
        "UPDATE donations SET pickup_location_new = "
        "json_build_object('raw', pickup_location) WHERE pickup_location IS NOT NULL"
    )
    op.drop_column("donations", "pickup_location")
    op.alter_column("donations", "pickup_location_new", new_column_name="pickup_location")
    op.alter_column("donations", "pickup_location", nullable=False)


def downgrade() -> None:
    op.add_column("donations", sa.Column("pickup_location_old", sa.String(200), nullable=True))
    op.execute(
        "UPDATE donations SET pickup_location_old = pickup_location::text WHERE pickup_location IS NOT NULL"
    )
    op.drop_column("donations", "pickup_location")
    op.alter_column("donations", "pickup_location_old", new_column_name="pickup_location")
    op.alter_column("donations", "pickup_location", nullable=False)

    op.drop_column("donations", "food_safety_info")
    op.drop_column("donations", "special_handling")
