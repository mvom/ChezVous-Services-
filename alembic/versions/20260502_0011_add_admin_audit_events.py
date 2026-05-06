"""Add admin audit events table

Revision ID: 20260502_0011
Revises: 20260501_0010
Create Date: 2026-05-02
"""

from alembic import op

revision = "20260502_0011"
down_revision = "20260501_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'admin_audit_events'
            ) THEN
                CREATE TABLE admin_audit_events (
                    id SERIAL PRIMARY KEY,
                    event_type VARCHAR(64) NOT NULL,
                    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    actor_role VARCHAR(20) NOT NULL,
                    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                    target_role VARCHAR(20) NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'ix_admin_audit_events_created_at'
            ) THEN
                CREATE INDEX ix_admin_audit_events_created_at ON admin_audit_events (created_at DESC);
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'ix_admin_audit_events_actor_user_id'
            ) THEN
                CREATE INDEX ix_admin_audit_events_actor_user_id ON admin_audit_events (actor_user_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public' AND indexname = 'ix_admin_audit_events_target_user_id'
            ) THEN
                CREATE INDEX ix_admin_audit_events_target_user_id ON admin_audit_events (target_user_id);
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
            DROP INDEX IF EXISTS ix_admin_audit_events_target_user_id;
            DROP INDEX IF EXISTS ix_admin_audit_events_actor_user_id;
            DROP INDEX IF EXISTS ix_admin_audit_events_created_at;
            DROP TABLE IF EXISTS admin_audit_events;
        END;
        $$;
        """
    )
