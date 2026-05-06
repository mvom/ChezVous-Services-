"""Add availability fields for demandes and services

Revision ID: 20260501_0008
Revises: 20260501_0007
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0008"
down_revision = "20260501_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'client_availability_mode'
            ) THEN
                ALTER TABLE demandes
                ADD COLUMN client_availability_mode VARCHAR(16) NOT NULL DEFAULT 'flexible';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'client_availability_note'
            ) THEN
                ALTER TABLE demandes ADD COLUMN client_availability_note VARCHAR(255) NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'services' AND column_name = 'availability_slots'
            ) THEN
                ALTER TABLE services ADD COLUMN availability_slots TEXT NOT NULL DEFAULT '';
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE services DROP COLUMN IF EXISTS availability_slots;")
    op.execute("ALTER TABLE demandes DROP COLUMN IF EXISTS client_availability_note;")
    op.execute("ALTER TABLE demandes DROP COLUMN IF EXISTS client_availability_mode;")
