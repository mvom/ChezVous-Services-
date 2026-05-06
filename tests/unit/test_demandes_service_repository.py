from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from app.db.models import Demande, DemandeEvent
from app.schemas.demande import DemandeCreate
from app.schemas.user import UserRole
from app.domains.demandes.service import DemandesService


class FakeDemandesRepository:
    def __init__(self) -> None:
        self._demande_seq = 100
        self._event_seq = 1
        self._clients = {1: object()}
        self._demandes: dict[int, Demande] = {}
        self.committed = False

    def get_client(self, client_id: int):
        return self._clients.get(client_id)

    def add_demande(self, demande: Demande) -> None:
        self._demande_seq += 1
        now = datetime.now(UTC)
        demande.id = self._demande_seq
        demande.created_at = now
        demande.updated_at = now
        demande.events = []
        self._demandes[demande.id] = demande

    def flush(self) -> None:
        return

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
        demande = self._demandes[demande_id]
        event = DemandeEvent(
            demande_id=demande_id,
            event_type=event_type,
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            previous_status=previous_status,
            new_status=new_status,
        )
        event.id = self._event_seq
        event.created_at = datetime.now(UTC)
        self._event_seq += 1
        demande.events.append(event)

    def commit(self) -> None:
        self.committed = True

    def refresh_demande(self, demande: Demande) -> None:
        return

    def get_demande(self, demande_id: int) -> Demande | None:
        return self._demandes.get(demande_id)

    def list_demandes_with_events(self) -> list[Demande]:
        return list(self._demandes.values())


@pytest.mark.unit
def test_create_demande_works_with_fake_repository_without_db_session():
    fake_repo = FakeDemandesRepository()
    service = DemandesService(
        repository_factory=lambda _db: fake_repo,
        zone_notifier=lambda _db, _demande: None,
    )
    actor = MagicMock()
    actor.id = 1
    actor.first_name = "Alice"
    actor.last_name = "Dupont"
    actor.role = UserRole.CLIENT

    payload = DemandeCreate(
        client_id=1,
        description="Nettoyage general appartement",
        ville="Douala",
        arrondissement="Bonanjo",
        quartier="Akwa",
    )

    result = service.create_demande(
        db=None,
        payload=payload,
        actor_user=actor,
        actor_role=UserRole.CLIENT,
    )

    assert result.client_id == 1
    assert result.status.value == "ouverte"
    assert result.events[0].event_type == "cree"
    assert "Alice Dupont" in (result.events[0].actor_label or "")
    assert fake_repo.committed is True
