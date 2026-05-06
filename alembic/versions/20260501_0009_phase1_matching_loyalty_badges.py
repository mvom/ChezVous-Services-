"""Phase 1 — matching geo fields, loyalty, badges

Adds:
- prestataires.latitude / longitude
- demandes.latitude / longitude
- clients.loyalty_points / completed_missions_count
- table badges (user_id, slug, awarded_at)

Revision ID: 20260501_0009
Revises: 20260501_0008
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0009"
down_revision = "20260501_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            -- prestataires geo
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'prestataires' AND column_name = 'latitude'
            ) THEN
                ALTER TABLE prestataires ADD COLUMN latitude NUMERIC(9,6) NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'prestataires' AND column_name = 'longitude'
            ) THEN
                ALTER TABLE prestataires ADD COLUMN longitude NUMERIC(9,6) NULL;
            END IF;

            -- demandes geo
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'latitude'
            ) THEN
                ALTER TABLE demandes ADD COLUMN latitude NUMERIC(9,6) NULL;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'demandes' AND column_name = 'longitude'
            ) THEN
                ALTER TABLE demandes ADD COLUMN longitude NUMERIC(9,6) NULL;
            END IF;

            -- clients loyalty
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'clients' AND column_name = 'loyalty_points'
            ) THEN
                ALTER TABLE clients ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'clients' AND column_name = 'completed_missions_count'
            ) THEN
                ALTER TABLE clients ADD COLUMN completed_missions_count INTEGER NOT NULL DEFAULT 0;
            END IF;

            -- badges table
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'badges'
            ) THEN
                CREATE TABLE badges (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    slug VARCHAR(60) NOT NULL,
                    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                CREATE INDEX ix_badges_user_id ON badges (user_id);
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
            DROP TABLE IF EXISTS badges;
            ALTER TABLE clients DROP COLUMN IF EXISTS completed_missions_count;
            ALTER TABLE clients DROP COLUMN IF EXISTS loyalty_points;
            ALTER TABLE demandes DROP COLUMN IF EXISTS longitude;
            ALTER TABLE demandes DROP COLUMN IF EXISTS latitude;
            ALTER TABLE prestataires DROP COLUMN IF EXISTS longitude;
            ALTER TABLE prestataires DROP COLUMN IF EXISTS latitude;
        END;
        $$;
        """
    )
