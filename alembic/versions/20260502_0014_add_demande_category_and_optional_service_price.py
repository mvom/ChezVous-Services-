"""Add demande category and make service price optional

Revision ID: 20260502_0014
Revises: 20260502_0013
Create Date: 2026-05-02
"""

from alembic import op

revision = "20260502_0014"
down_revision = "20260502_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE demandes
        ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'menage';
        """
    )

    op.execute(
        """
        UPDATE demandes
        SET category = 'menage'
        WHERE category IS NULL OR category = '';
        """
    )

    op.execute(
        """
        ALTER TABLE services
        ALTER COLUMN price DROP NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE services
        SET price = 0
        WHERE price IS NULL;
        """
    )

    op.execute(
        """
        ALTER TABLE services
        ALTER COLUMN price SET NOT NULL;
        """
    )

    op.execute(
        """
        ALTER TABLE demandes
        DROP COLUMN IF EXISTS category;
        """
    )
