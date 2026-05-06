from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id", ondelete="CASCADE"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.user_id", ondelete="RESTRICT"))
    prestataire_id: Mapped[int] = mapped_column(ForeignKey("prestataires.user_id", ondelete="RESTRICT"))
    rating: Mapped[int]
    comment: Mapped[str] = mapped_column(Text, default="")
