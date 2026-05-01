"""Add city, district, neighborhood fields to demandes

Revision ID: 20260501_0007
Revises: 20260501_0006
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0007"
down_revision = "20260501_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'ville'
            ) THEN
                ALTER TABLE demandes ADD COLUMN ville VARCHAR(80) NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'arrondissement'
            ) THEN
                ALTER TABLE demandes ADD COLUMN arrondissement VARCHAR(80) NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'quartier'
            ) THEN
                ALTER TABLE demandes ADD COLUMN quartier VARCHAR(120) NULL;
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE demandes DROP COLUMN IF EXISTS quartier;")
    op.execute("ALTER TABLE demandes DROP COLUMN IF EXISTS arrondissement;")
    op.execute("ALTER TABLE demandes DROP COLUMN IF EXISTS ville;")
