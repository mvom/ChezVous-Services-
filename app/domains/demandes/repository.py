from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Client, Demande, DemandeEvent


class DemandesRepository(Protocol):
    def get_client(self, client_id: int) -> Client | None:
        ...

    def add_demande(self, demande: Demande) -> None:
        ...

    def flush(self) -> None:
        ...

    def add_demande_event(
        self,
        *,
        demande_id: int,
        event_type: str,
        actor_user_id: int | None,
        actor_label: str | None,
        previous_status: str | None,
        new_status: str | None,
    ) -> None:
        ...

    def commit(self) -> None:
        ...

    def refresh_demande(self, demande: Demande) -> None:
        ...

    def get_demande(self, demande_id: int) -> Demande | None:
        ...

    def list_demandes_with_events(self) -> list[Demande]:
        ...


class SqlAlchemyDemandesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_client(self, client_id: int) -> Client | None:
        return self.db.get(Client, client_id)

    def add_demande(self, demande: Demande) -> None:
        self.db.add(demande)

    def flush(self) -> None:
        self.db.flush()

    def add_demande_event(
        self,
        *,
        demande_id: int,
        event_type: str,
        actor_user_id: int | None,
        actor_label: str | None,
        previous_status: str | None,
        new_status: str | None,
    ) -> None:
        self.db.add(
            DemandeEvent(
                demande_id=demande_id,
                event_type=event_type,
                previous_status=previous_status,
                new_status=new_status,
                actor_user_id=actor_user_id,
                actor_label=actor_label,
            )
        )

    def commit(self) -> None:
        self.db.commit()

    def refresh_demande(self, demande: Demande) -> None:
        self.db.refresh(demande)

    def get_demande(self, demande_id: int) -> Demande | None:
        return self.db.get(Demande, demande_id)

    def list_demandes_with_events(self) -> list[Demande]:
        return self.db.scalars(
            select(Demande)
            .options(selectinload(Demande.events))
            .order_by(Demande.created_at.desc(), Demande.id.desc())
        ).all()
