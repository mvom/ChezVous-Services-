from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, enum_values
from app.schemas.prestataire import VisibilityMode
from app.schemas.user import UserRole


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("role", "phone", name="uq_users_role_phone"),
        UniqueConstraint("role", "email", name="uq_users_role_email"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(60))
    last_name: Mapped[str] = mapped_column(String(60))
    username: Mapped[str] = mapped_column(String(30))
    email: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=False, values_callable=enum_values)
    )


class UserRoleLink(Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
        Index("ix_user_roles_user_id", "user_id"),
        Index("ix_user_roles_role", "role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=False, values_callable=enum_values),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Client(Base):
    __tablename__ = "clients"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    loyalty_points: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    completed_missions_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class Prestataire(Base):
    __tablename__ = "prestataires"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0.0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    visibility_mode: Mapped[VisibilityMode] = mapped_column(
        Enum(VisibilityMode, name="visibility_mode_enum", create_constraint=False, values_callable=enum_values),
        default=VisibilityMode.PUBLIC,
        server_default=VisibilityMode.PUBLIC.value,
        nullable=False,
    )
    zone_preference_ville: Mapped[str | None] = mapped_column(String(80), nullable=True)
    zone_preference_arrondissement: Mapped[str | None] = mapped_column(String(80), nullable=True)
    zone_preference_quartier: Mapped[str | None] = mapped_column(String(120), nullable=True)
