from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, enum_values
from app.domains.paiement.schemas import PaiementMethod, PaiementStatus


class Paiement(Base):
    __tablename__ = "paiements"

    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id", ondelete="CASCADE"), unique=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    status: Mapped[PaiementStatus] = mapped_column(
        Enum(PaiementStatus, name="paiement_status", create_constraint=False, values_callable=enum_values),
        default=PaiementStatus.EN_ATTENTE,
    )
    method: Mapped[PaiementMethod] = mapped_column(
        Enum(PaiementMethod, name="paiement_method", create_constraint=False, values_callable=enum_values)
    )
