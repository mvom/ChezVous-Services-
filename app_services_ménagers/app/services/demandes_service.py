from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Client, Demande
from app.schemas.demande import DemandeCreate, DemandeRead, DemandeStatus


class DemandesService:
    def create_demande(self, db: Session, payload: DemandeCreate) -> DemandeRead:
        client = db.get(Client, payload.client_id)
        if client is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client invalide")

        demande = Demande(
            client_id=payload.client_id,
            description=payload.description,
            location=payload.location,
            status=DemandeStatus.OUVERTE,
        )
        db.add(demande)
        db.commit()
        db.refresh(demande)
        return DemandeRead.model_validate(demande)

    def list_demandes(self, db: Session) -> list[DemandeRead]:
        demandes = db.scalars(select(Demande).order_by(Demande.id)).all()
        return [DemandeRead.model_validate(item) for item in demandes]

    def get_demande(self, db: Session, demande_id: int) -> Demande:
        demande = db.get(Demande, demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
        return demande

    def update_status(self, db: Session, demande_id: int, new_status: DemandeStatus) -> DemandeRead:
        demande = self.get_demande(db, demande_id)
        demande.status = new_status
        db.commit()
        db.refresh(demande)
        return DemandeRead.model_validate(demande)


demandes_service = DemandesService()
