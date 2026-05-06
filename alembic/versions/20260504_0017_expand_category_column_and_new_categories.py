"""expand category column to VARCHAR(30) for new categories

Revision ID: 20260504_0017
Revises: 20260503_0016
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = "20260504_0017"
down_revision = "20260503_0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "demandes",
        "category",
        existing_type=sa.String(20),
        type_=sa.String(30),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "demandes",
        "category",
        existing_type=sa.String(30),
        type_=sa.String(20),
        existing_nullable=False,
    )
