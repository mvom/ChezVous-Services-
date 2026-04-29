from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Mission, Paiement
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementStatus


class PaiementsService:
    def create_paiement(self, db: Session, payload: PaiementCreate) -> PaiementRead:
        if db.get(Mission, payload.mission_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mission invalide")

        paiement = Paiement(
            mission_id=payload.mission_id,
            amount=payload.amount,
            status=PaiementStatus.EN_ATTENTE,
            method=payload.method,
        )
        db.add(paiement)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un paiement existe deja pour cette mission",
            ) from exc
        db.refresh(paiement)
        return PaiementRead.model_validate(paiement)

    def list_paiements(self, db: Session) -> list[PaiementRead]:
        paiements = db.scalars(select(Paiement).order_by(Paiement.id)).all()
        return [PaiementRead.model_validate(item) for item in paiements]

    def update_status(self, db: Session, paiement_id: int, new_status: PaiementStatus) -> PaiementRead:
        paiement = db.get(Paiement, paiement_id)
        if paiement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable")
        paiement.status = new_status
        db.commit()
        db.refresh(paiement)
        return PaiementRead.model_validate(paiement)


paiements_service = PaiementsService()
