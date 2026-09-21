"""add match breakdown

Revision ID: 004_add_match_breakdown
Revises: 003_matching_engine
Create Date: 2026-09-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '004_add_match_breakdown'
down_revision: Union[str, None] = '003_matching_engine'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('donations', sa.Column('match_breakdown', sa.JSON(), nullable=True))

def downgrade() -> None:
    op.drop_column('donations', 'match_breakdown')
