from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Mission, Paiement


class PaiementsRepository(Protocol):
    def get_mission(self, mission_id: int) -> Mission | None:
        ...

    def get_paiement(self, paiement_id: int) -> Paiement | None:
        ...

    def add_paiement(self, paiement: Paiement) -> None:
        ...

    def list_paiements(self) -> list[Paiement]:
        ...

    def flush(self) -> None:
        ...

    def commit(self) -> None:
        ...

    def rollback(self) -> None:
        ...

    def refresh(self, paiement: Paiement) -> None:
        ...


class SqlAlchemyPaiementsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_mission(self, mission_id: int) -> Mission | None:
        return self.db.get(Mission, mission_id)

    def get_paiement(self, paiement_id: int) -> Paiement | None:
        return self.db.get(Paiement, paiement_id)

    def add_paiement(self, paiement: Paiement) -> None:
        self.db.add(paiement)

    def list_paiements(self) -> list[Paiement]:
        return self.db.scalars(select(Paiement).order_by(Paiement.id)).all()

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def refresh(self, paiement: Paiement) -> None:
        self.db.refresh(paiement)
