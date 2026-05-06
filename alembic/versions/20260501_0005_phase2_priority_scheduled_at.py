"""phase2: priority on demandes, scheduled_at on missions

Revision ID: 20260501_0005
Revises: 20260501_0004
Create Date: 2026-05-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260501_0005"
down_revision = "20260501_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add priority column to demandes (default: normale)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'priority'
            ) THEN
                ALTER TABLE demandes ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'normale';
            END IF;
        END$$;
    """)

    # Add scheduled_at column to missions (nullable datetime)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'missions' AND column_name = 'scheduled_at'
            ) THEN
                ALTER TABLE missions ADD COLUMN scheduled_at TIMESTAMPTZ NULL;
            END IF;
        END$$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE demandes DROP COLUMN IF EXISTS priority;
    """)
    op.execute("""
        ALTER TABLE missions DROP COLUMN IF EXISTS scheduled_at;
    """)
