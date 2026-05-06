"""Add visibility_mode to prestataires

Revision ID: 20260502_0012
Revises: 20260502_0011
Create Date: 2026-05-02
"""

from alembic import op

revision = "20260502_0012"
down_revision = "20260502_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'prestataires' AND column_name = 'visibility_mode'
            ) THEN
                ALTER TABLE prestataires
                    ADD COLUMN visibility_mode VARCHAR(20) NOT NULL DEFAULT 'public';
            END IF;
        END;
        $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            ALTER TABLE prestataires DROP COLUMN IF EXISTS visibility_mode;
        END;
        $$;
        """
    )
