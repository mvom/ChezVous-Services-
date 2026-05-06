"""Add prestataire zone_preference and notifications table

Revision ID: 20260503_0015
Revises: 20260502_0014
Create Date: 2026-05-03
"""

from alembic import op

revision = "20260503_0015"
down_revision = "20260502_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE prestataires
        ADD COLUMN IF NOT EXISTS zone_preference_ville VARCHAR(80),
        ADD COLUMN IF NOT EXISTS zone_preference_arrondissement VARCHAR(80),
        ADD COLUMN IF NOT EXISTS zone_preference_quartier VARCHAR(120);
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            prestataire_id INTEGER NOT NULL REFERENCES prestataires(user_id) ON DELETE CASCADE,
            demande_id INTEGER NOT NULL REFERENCES demandes(id) ON DELETE CASCADE,
            message VARCHAR(255) NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_notifications_prestataire_id
        ON notifications (prestataire_id);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notifications;")
    op.execute(
        """
        ALTER TABLE prestataires
        DROP COLUMN IF EXISTS zone_preference_ville,
        DROP COLUMN IF EXISTS zone_preference_arrondissement,
        DROP COLUMN IF EXISTS zone_preference_quartier;
        """
    )
