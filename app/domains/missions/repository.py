from typing import Protocol, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Client, Demande, Mission, Prestataire, User


class MissionsRepository(Protocol):
    def get_mission(self, mission_id: int) -> Mission | None: ...
    def get_mission_by_demande_id(self, demande_id: int) -> Mission | None: ...
    def get_demande(self, demande_id: int) -> Demande | None: ...
    def get_client(self, client_id: int) -> Client | None: ...
    def get_prestataire(self, prestataire_id: int) -> Prestataire | None: ...
    def add_mission(self, mission: Mission) -> None: ...
    def list_missions(self) -> Sequence[Mission]: ...
    def list_prestataires_by_ids(self, ids: list[int]) -> Sequence[Prestataire]: ...
    def list_users_by_ids(self, ids: list[int]) -> Sequence[User]: ...
    def list_missions_by_prestataire_ids(self, ids: list[int]) -> Sequence[Mission]: ...
    def list_demandes_by_ids(self, ids: list[int]) -> Sequence[Demande]: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...
    def refresh_mission(self, mission: Mission) -> None: ...


class SqlAlchemyMissionsRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_mission(self, mission_id: int) -> Mission | None:
        return self._db.get(Mission, mission_id)

    def get_mission_by_demande_id(self, demande_id: int) -> Mission | None:
        return self._db.scalar(select(Mission).where(Mission.demande_id == demande_id))

    def get_demande(self, demande_id: int) -> Demande | None:
        return self._db.get(Demande, demande_id)

    def get_client(self, client_id: int) -> Client | None:
        return self._db.get(Client, client_id)

    def get_prestataire(self, prestataire_id: int) -> Prestataire | None:
        return self._db.get(Prestataire, prestataire_id)

    def add_mission(self, mission: Mission) -> None:
        self._db.add(mission)

    def list_missions(self) -> Sequence[Mission]:
        return self._db.scalars(
            select(Mission).order_by(Mission.created_at.desc(), Mission.id.desc())
        ).all()

    def list_prestataires_by_ids(self, ids: list[int]) -> Sequence[Prestataire]:
        if not ids:
            return []
        return self._db.scalars(select(Prestataire).where(Prestataire.user_id.in_(ids))).all()

    def list_users_by_ids(self, ids: list[int]) -> Sequence[User]:
        if not ids:
            return []
        return self._db.scalars(select(User).where(User.id.in_(ids))).all()

    def list_missions_by_prestataire_ids(self, ids: list[int]) -> Sequence[Mission]:
        if not ids:
            return []
        return self._db.scalars(
            select(Mission)
            .where(Mission.prestataire_id.in_(ids))
            .order_by(Mission.created_at.asc(), Mission.id.asc())
        ).all()

    def list_demandes_by_ids(self, ids: list[int]) -> Sequence[Demande]:
        if not ids:
            return []
        return self._db.scalars(select(Demande).where(Demande.id.in_(ids))).all()

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh_mission(self, mission: Mission) -> None:
        self._db.refresh(mission)
