"""Add avatar_url to users table

Revision ID: 20260501_0006
Revises: 20260501_0005
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0006"
down_revision = "20260501_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'avatar_url'
            ) THEN
                ALTER TABLE users ADD COLUMN avatar_url TEXT NULL;
            END IF;
        END$$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;")
