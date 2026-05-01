from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Prestataire
from app.schemas.prestataire import PrestataireRead


class PrestatairesService:
    def list_prestataires(self, db: Session, verified_only: bool = False) -> list[PrestataireRead]:
        stmt = select(Prestataire).order_by(Prestataire.user_id)
        if verified_only:
            stmt = stmt.where(Prestataire.verified.is_(True))
        prestataires = db.scalars(stmt).all()
        return [PrestataireRead.model_validate(item) for item in prestataires]

    def update_verified(self, db: Session, prestataire_id: int, verified: bool) -> PrestataireRead:
        prestataire = db.get(Prestataire, prestataire_id)
        if prestataire is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prestataire introuvable")
        prestataire.verified = verified
        db.commit()
        db.refresh(prestataire)
        return PrestataireRead.model_validate(prestataire)


prestataires_service = PrestatairesService()
