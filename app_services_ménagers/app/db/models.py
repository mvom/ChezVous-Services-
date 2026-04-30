from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

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
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_constraint=False, values_callable=_enum_values)
    )


class Client(Base):
    __tablename__ = "clients"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Prestataire(Base):
    __tablename__ = "prestataires"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0.0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Service(Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(primary_key=True)
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[float] = mapped_column(Numeric(12, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Demande(Base):
    __tablename__ = "demandes"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(255))
    status: Mapped[DemandeStatus] = mapped_column(
        Enum(DemandeStatus, name="demande_status", create_constraint=False, values_callable=_enum_values),
        default=DemandeStatus.OUVERTE,
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
