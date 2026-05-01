from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.schemas.demande import DemandeStatus
from app.schemas.mission import MissionStatus
from app.schemas.paiement import PaiementMethod, PaiementStatus
from app.schemas.user import UserRole


class Base(DeclarativeBase):
    pass


def _enum_values(enum_cls):
    return [item.value for item in enum_cls]


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
        Enum(UserRole, name="user_role", create_constraint=False, values_callable=_enum_values)
    )


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


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    availability_slots: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DemandeEvent(Base):
    __tablename__ = "demande_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    demande: Mapped["Demande"] = relationship(back_populates="events")


class Demande(Base):
    __tablename__ = "demandes"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(255))
    ville: Mapped[str | None] = mapped_column(String(80), nullable=True)
    arrondissement: Mapped[str | None] = mapped_column(String(80), nullable=True)
    quartier: Mapped[str | None] = mapped_column(String(120), nullable=True)
    client_availability_mode: Mapped[str] = mapped_column(String(16), default="flexible", nullable=False)
    client_availability_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="normale", server_default="normale", nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    status: Mapped[DemandeStatus] = mapped_column(
        Enum(DemandeStatus, name="demande_status", create_constraint=False, values_callable=_enum_values),
        default=DemandeStatus.OUVERTE,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    events: Mapped[list[DemandeEvent]] = relationship(
        back_populates="demande",
        cascade="all, delete-orphan",
        order_by=lambda: (DemandeEvent.created_at.asc(), DemandeEvent.id.asc()),
    )


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes.id", ondelete="RESTRICT"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[MissionStatus] = mapped_column(
        Enum(MissionStatus, name="mission_status", create_constraint=False, values_callable=_enum_values),
        default=MissionStatus.EN_ATTENTE,
    )
    at_risk: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id", ondelete="CASCADE"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    rating: Mapped[int]
    comment: Mapped[str] = mapped_column(Text, default="")


class Paiement(Base):
    __tablename__ = "paiements"

    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id", ondelete="CASCADE"), unique=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[PaiementStatus] = mapped_column(
        Enum(PaiementStatus, name="paiement_status", create_constraint=False, values_callable=_enum_values),
        default=PaiementStatus.EN_ATTENTE,
    )
    method: Mapped[PaiementMethod] = mapped_column(
        Enum(PaiementMethod, name="paiement_method", create_constraint=False, values_callable=_enum_values)
    )


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
