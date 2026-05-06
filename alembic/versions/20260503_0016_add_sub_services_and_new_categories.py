"""add sub_services column and new service categories

Revision ID: 20260503_0016
Revises: 20260503_0015
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

revision = "20260503_0016"
down_revision = "20260503_0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add sub_services JSON column to demandes
    op.add_column(
        "demandes",
        sa.Column("sub_services", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("demandes", "sub_services")
