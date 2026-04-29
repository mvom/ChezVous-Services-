"""initial schema

Revision ID: 20260429_0001
Revises: None
Create Date: 2026-04-29 19:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260429_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role = postgresql.ENUM("client", "prestataire", "admin", name="user_role", create_type=False)
demande_status = postgresql.ENUM(
    "ouverte", "attribuee", "annulee", "expiree", name="demande_status", create_type=False
)
mission_status = postgresql.ENUM(
    "en_attente",
    "acceptee",
    "confirmee",
    "en_cours",
    "terminee",
    "annulee",
    "litige",
    name="mission_status",
    create_type=False,
)
paiement_status = postgresql.ENUM(
    "en_attente", "paye", "echoue", "rembourse", name="paiement_status", create_type=False
)
paiement_method = postgresql.ENUM(
    "mobile_money", "carte", "virement", "especes", name="paiement_method", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    demande_status.create(bind, checkfirst=True)
    mission_status.create(bind, checkfirst=True)
    paiement_status.create(bind, checkfirst=True)
    paiement_method.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "clients",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "prestataires",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index("ix_prestataires_verified", "prestataires", ["verified"], unique=False)

    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("prestataire_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["prestataire_id"], ["prestataires.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_services_prestataire", "services", ["prestataire_id"], unique=False)

    op.create_table(
        "demandes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("status", demande_status, nullable=False, server_default=sa.text("'ouverte'")),
        sa.ForeignKeyConstraint(["client_id"], ["clients.user_id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_demandes_client", "demandes", ["client_id"], unique=False)
    op.create_index("ix_demandes_status", "demandes", ["status"], unique=False)

    op.create_table(
        "missions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("demande_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("prestataire_id", sa.Integer(), nullable=False),
        sa.Column("service_id", sa.Integer(), nullable=True),
        sa.Column("status", mission_status, nullable=False, server_default=sa.text("'en_attente'")),
        sa.ForeignKeyConstraint(["client_id"], ["clients.user_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["demande_id"], ["demandes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["prestataire_id"], ["prestataires.user_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("demande_id", name="uq_missions_demande_id"),
    )
    op.create_index("ix_missions_client", "missions", ["client_id"], unique=False)
    op.create_index("ix_missions_prestataire", "missions", ["prestataire_id"], unique=False)
    op.create_index("ix_missions_status", "missions", ["status"], unique=False)

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("prestataire_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=False, server_default=sa.text("''")),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.user_id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prestataire_id"], ["prestataires.user_id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("mission_id", name="uq_reviews_mission_id"),
    )
    op.create_index("ix_reviews_prestataire", "reviews", ["prestataire_id"], unique=False)

    op.create_table(
        "paiements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", paiement_status, nullable=False, server_default=sa.text("'en_attente'")),
        sa.Column("method", paiement_method, nullable=False),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("mission_id", name="uq_paiements_mission_id"),
    )
    op.create_index("ix_paiements_status", "paiements", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_paiements_status", table_name="paiements")
    op.drop_table("paiements")
    op.drop_index("ix_reviews_prestataire", table_name="reviews")
    op.drop_table("reviews")
    op.drop_index("ix_missions_status", table_name="missions")
    op.drop_index("ix_missions_prestataire", table_name="missions")
    op.drop_index("ix_missions_client", table_name="missions")
    op.drop_table("missions")
    op.drop_index("ix_demandes_status", table_name="demandes")
    op.drop_index("ix_demandes_client", table_name="demandes")
    op.drop_table("demandes")
    op.drop_index("ix_services_prestataire", table_name="services")
    op.drop_table("services")
    op.drop_index("ix_prestataires_verified", table_name="prestataires")
    op.drop_table("prestataires")
    op.drop_table("clients")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    paiement_method.drop(bind, checkfirst=True)
    paiement_status.drop(bind, checkfirst=True)
    mission_status.drop(bind, checkfirst=True)
    demande_status.drop(bind, checkfirst=True)
    user_role.drop(bind, checkfirst=True)
