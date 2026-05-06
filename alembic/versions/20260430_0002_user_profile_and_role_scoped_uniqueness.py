"""user profile fields and role scoped uniqueness

Revision ID: 20260430_0002
Revises: 20260429_0001
Create Date: 2026-04-30 16:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260430_0002"
down_revision = "20260429_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=60), nullable=True))
    op.add_column("users", sa.Column("username", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("address", sa.String(length=255), nullable=True))

    op.execute(
        """
        UPDATE users
        SET
            first_name = split_part(full_name, ' ', 1),
            last_name = COALESCE(NULLIF(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''), 'Inconnu'),
            username = 'user_' || id::text,
            email = 'user_' || id::text || '@example.local',
            address = 'Adresse non renseignee'
        """
    )

    op.alter_column("users", "first_name", nullable=False)
    op.alter_column("users", "last_name", nullable=False)
    op.alter_column("users", "username", nullable=False)
    op.alter_column("users", "email", nullable=False)
    op.alter_column("users", "address", nullable=False)

    # Legacy schemas may name this unique constraint differently.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_phone")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_role_phone")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_role_email")
    op.create_unique_constraint("uq_users_role_phone", "users", ["role", "phone"])
    op.create_unique_constraint("uq_users_role_email", "users", ["role", "email"])
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS full_name")


def downgrade() -> None:
    op.add_column("users", sa.Column("full_name", sa.String(length=120), nullable=True))

    op.execute(
        """
        UPDATE users
        SET full_name = trim(first_name || ' ' || last_name)
        """
    )

    op.alter_column("users", "full_name", nullable=False)

    op.drop_constraint("uq_users_role_email", "users", type_="unique")
    op.drop_constraint("uq_users_role_phone", "users", type_="unique")
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])

    op.drop_column("users", "address")
    op.drop_column("users", "email")
    op.drop_column("users", "username")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")
