from typing import Protocol, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Notification, Prestataire, User


class PrestatairesRepository(Protocol):
    def get_prestataire(self, prestataire_id: int) -> Prestataire | None: ...
    def list_prestataires(self, verified_only: bool = False) -> Sequence[Prestataire]: ...
    def list_prestataires_with_users(self) -> Sequence[tuple[Prestataire, User]]: ...
    def list_notifications(self, prestataire_id: int) -> Sequence[Notification]: ...
    def mark_notifications_read(self, prestataire_id: int) -> None: ...
    def commit(self) -> None: ...
    def refresh_prestataire(self, prestataire: Prestataire) -> None: ...


class SqlAlchemyPrestatairesRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_prestataire(self, prestataire_id: int) -> Prestataire | None:
        return self._db.get(Prestataire, prestataire_id)

    def list_prestataires(self, verified_only: bool = False) -> Sequence[Prestataire]:
        stmt = select(Prestataire).order_by(Prestataire.user_id)
        if verified_only:
            stmt = stmt.where(Prestataire.verified.is_(True))
        return self._db.scalars(stmt).all()

    def list_prestataires_with_users(self) -> Sequence[tuple[Prestataire, User]]:
        stmt = (
            select(Prestataire, User)
            .join(User, User.id == Prestataire.user_id)
            .where(Prestataire.zone_preference_ville.isnot(None))
        )
        return self._db.execute(stmt).all()

    def list_notifications(self, prestataire_id: int) -> Sequence[Notification]:
        return self._db.scalars(
            select(Notification)
            .where(Notification.prestataire_id == prestataire_id)
            .order_by(Notification.created_at.desc())
        ).all()

    def mark_notifications_read(self, prestataire_id: int) -> None:
        self._db.execute(
            Notification.__table__.update()
            .where(Notification.prestataire_id == prestataire_id)
            .values(is_read=True)
        )
        self._db.commit()

    def commit(self) -> None:
        self._db.commit()

    def refresh_prestataire(self, prestataire: Prestataire) -> None:
        self._db.refresh(prestataire)
