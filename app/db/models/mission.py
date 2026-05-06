from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, enum_values
from app.schemas.mission import MissionStatus


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(primary_key=True)
    demande_id: Mapped[int] = mapped_column(ForeignKey("demandes.id", ondelete="RESTRICT"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[MissionStatus] = mapped_column(
        Enum(MissionStatus, name="mission_status", create_constraint=False, values_callable=enum_values),
        default=MissionStatus.EN_ATTENTE,
    )
    at_risk: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
