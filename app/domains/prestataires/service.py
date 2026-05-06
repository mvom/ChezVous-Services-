from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Notification, Prestataire, User
from app.domains.prestataires.repository import PrestatairesRepository, SqlAlchemyPrestatairesRepository
from app.schemas.prestataire import NotificationRead, PrestataireRead, VisibilityMode, ZonePreferenceUpdate


class PrestatairesService:
    def __init__(self, repository_factory: Callable[[Session], PrestatairesRepository] | None = None) -> None:
        self._repository_factory = repository_factory or (lambda db: SqlAlchemyPrestatairesRepository(db))

    def _repo(self, db: Session) -> PrestatairesRepository:
        return self._repository_factory(db)

    def list_prestataires(self, db: Session, verified_only: bool = False) -> list[PrestataireRead]:
        repo = self._repo(db)
        prestataires = repo.list_prestataires(verified_only=verified_only)
        return [PrestataireRead.model_validate(item) for item in prestataires]

    def update_verified(self, db: Session, prestataire_id: int, verified: bool) -> PrestataireRead:
        repo = self._repo(db)
        prestataire = repo.get_prestataire(prestataire_id)
        if prestataire is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prestataire introuvable")
        prestataire.verified = verified
        repo.commit()
        repo.refresh_prestataire(prestataire)
        return PrestataireRead.model_validate(prestataire)

    def update_visibility_mode(self, db: Session, prestataire_id: int, visibility_mode: VisibilityMode) -> PrestataireRead:
        repo = self._repo(db)
        prestataire = repo.get_prestataire(prestataire_id)
        if prestataire is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prestataire introuvable")
        prestataire.visibility_mode = visibility_mode
        repo.commit()
        repo.refresh_prestataire(prestataire)
        return PrestataireRead.model_validate(prestataire)

    def update_zone_preference(self, db: Session, prestataire_id: int, payload: ZonePreferenceUpdate) -> PrestataireRead:
        repo = self._repo(db)
        prestataire = repo.get_prestataire(prestataire_id)
        if prestataire is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prestataire introuvable")
        prestataire.zone_preference_ville = (payload.zone_preference_ville or "").strip() or None
        prestataire.zone_preference_arrondissement = (payload.zone_preference_arrondissement or "").strip() or None
        prestataire.zone_preference_quartier = (payload.zone_preference_quartier or "").strip() or None
        repo.commit()
        repo.refresh_prestataire(prestataire)
        return PrestataireRead.model_validate(prestataire)

    def find_prestataires_in_zone(
        self,
        db: Session,
        ville: str | None,
        arrondissement: str | None,
        quartier: str | None,
    ) -> list[tuple[Prestataire, User]]:
        """Return prestataires whose zone preference matches the given demande location."""
        repo = self._repo(db)
        rows = repo.list_prestataires_with_users()
        results: list[tuple[Prestataire, User]] = []
        for prest, user in rows:
            if not _zone_matches(prest, ville, arrondissement, quartier):
                continue
            results.append((prest, user))
        return results

    def list_notifications(self, db: Session, prestataire_id: int) -> list[NotificationRead]:
        repo = self._repo(db)
        notifs = repo.list_notifications(prestataire_id)
        return [NotificationRead.model_validate(n) for n in notifs]

    def mark_notifications_read(self, db: Session, prestataire_id: int) -> None:
        repo = self._repo(db)
        repo.mark_notifications_read(prestataire_id)


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _zone_matches(
    prest: Prestataire,
    ville: str | None,
    arrondissement: str | None,
    quartier: str | None,
) -> bool:
    if _normalize(prest.zone_preference_ville) != _normalize(ville):
        return False
    if prest.zone_preference_arrondissement and _normalize(prest.zone_preference_arrondissement) != _normalize(arrondissement):
        return False
    if prest.zone_preference_quartier and _normalize(prest.zone_preference_quartier) != _normalize(quartier):
        return False
    return True


prestataires_service = PrestatairesService()
