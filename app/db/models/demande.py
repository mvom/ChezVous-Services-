from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, enum_values
from app.schemas.demande import DemandeStatus


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

    demande: Mapped[Demande] = relationship(back_populates="events")


class Demande(Base):
    __tablename__ = "demandes"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    category: Mapped[str] = mapped_column(String(30), default="menage", server_default="menage", nullable=False)
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(255))
    ville: Mapped[str | None] = mapped_column(String(80), nullable=True)
    arrondissement: Mapped[str | None] = mapped_column(String(80), nullable=True)
    quartier: Mapped[str | None] = mapped_column(String(120), nullable=True)
    client_availability_mode: Mapped[str] = mapped_column(String(16), default="flexible", nullable=False)
    client_availability_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="normale", server_default="normale", nullable=False)
    sub_services: Mapped[list | None] = mapped_column(JSON, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    status: Mapped[DemandeStatus] = mapped_column(
        Enum(DemandeStatus, name="demande_status", create_constraint=False, values_callable=enum_values),
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
