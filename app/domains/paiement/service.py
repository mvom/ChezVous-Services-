from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.db.models import Paiement
from .repository import PaiementsRepository
from .schemas import PaiementCreate, PaiementRead, PaiementStatus


class PaiementsService:
    def __init__(self, repo: PaiementsRepository) -> None:
        self.repo = repo

    def create_paiement(self, payload: PaiementCreate) -> PaiementRead:
        if self.repo.get_mission(payload.mission_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mission invalide")

        paiement = Paiement(
            mission_id=payload.mission_id,
            amount=payload.amount,
            status=PaiementStatus.EN_ATTENTE,
            method=payload.method,
        )
        self.repo.add_paiement(paiement)
        try:
            self.repo.commit()
        except IntegrityError as exc:
            self.repo.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un paiement existe deja pour cette mission",
            ) from exc
        self.repo.refresh(paiement)
        return PaiementRead.model_validate(paiement)

    def list_paiements(self) -> list[PaiementRead]:
        return [PaiementRead.model_validate(item) for item in self.repo.list_paiements()]

    def update_status(self, paiement_id: int, new_status: PaiementStatus) -> PaiementRead:
        paiement = self.repo.get_paiement(paiement_id)
        if paiement is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paiement introuvable")
        paiement.status = new_status
        self.repo.commit()
        self.repo.refresh(paiement)
        return PaiementRead.model_validate(paiement)
