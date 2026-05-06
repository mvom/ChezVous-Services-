"""Add persistent at_risk flag on missions

Revision ID: 20260501_0010
Revises: 20260501_0009
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0010"
down_revision = "20260501_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'missions' AND column_name = 'at_risk'
            ) THEN
                ALTER TABLE missions ADD COLUMN at_risk BOOLEAN NOT NULL DEFAULT FALSE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'ix_missions_at_risk'
            ) THEN
                CREATE INDEX ix_missions_at_risk ON missions (at_risk);
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
            DROP INDEX IF EXISTS ix_missions_at_risk;
            ALTER TABLE missions DROP COLUMN IF EXISTS at_risk;
        END;
        $$;
        """
    )
