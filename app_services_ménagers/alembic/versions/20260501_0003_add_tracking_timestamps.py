"""add tracking timestamps for demandes, missions and services

Revision ID: 20260501_0003
Revises: 20260430_0002
Create Date: 2026-05-01 10:15:00
"""

from alembic import op


revision = "20260501_0003"
down_revision = "20260430_0002"
branch_labels = None
depends_on = None


def _add_tracking_columns(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now() NOT NULL")
    op.execute(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL")


def _drop_tracking_columns(table_name: str) -> None:
    op.execute(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS updated_at")
    op.execute(f"ALTER TABLE {table_name} DROP COLUMN IF EXISTS created_at")


def upgrade() -> None:
    _add_tracking_columns("services")
    _add_tracking_columns("demandes")
    _add_tracking_columns("missions")


def downgrade() -> None:
    _drop_tracking_columns("missions")
    _drop_tracking_columns("demandes")
    _drop_tracking_columns("services")
