from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Client, Demande, DemandeEvent, User
from app.schemas.demande import DemandeCreate, DemandeRead, DemandeStatus


def _actor_label(actor_user: User | None) -> str | None:
    if actor_user is None:
        return None
    full_name = f"{actor_user.first_name} {actor_user.last_name}".strip()
    if full_name:
        return f"{full_name} ({actor_user.role.value})"
    return f"Utilisateur #{actor_user.id} ({actor_user.role.value})"


def record_demande_event(
    db: Session,
    demande: Demande,
    event_type: str,
    actor_user: User | None,
    previous_status: str | None = None,
    new_status: str | None = None,
) -> None:
    db.add(
        DemandeEvent(
            demande_id=demande.id,
            event_type=event_type,
            previous_status=previous_status,
            new_status=new_status,
            actor_user_id=actor_user.id if actor_user else None,
            actor_label=_actor_label(actor_user),
        )
    )


class DemandesService:
    def create_demande(self, db: Session, payload: DemandeCreate, actor_user: User | None = None) -> DemandeRead:
        client = db.get(Client, payload.client_id)
        if client is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client invalide")

        ville = payload.ville.strip()
        arrondissement = payload.arrondissement.strip()
        quartier = payload.quartier.strip()
        composed_location = ", ".join([ville, arrondissement, quartier])

        demande = Demande(
            client_id=payload.client_id,
            description=payload.description,
            location=(payload.location or composed_location).strip(),
            ville=ville,
            arrondissement=arrondissement,
            quartier=quartier,
            priority=payload.priority.value if hasattr(payload.priority, "value") else str(payload.priority),
            status=DemandeStatus.OUVERTE,
        )
        db.add(demande)
        db.flush()
        record_demande_event(
            db,
            demande,
            event_type="cree",
            actor_user=actor_user,
            previous_status=None,
            new_status=DemandeStatus.OUVERTE.value,
        )
        db.commit()
        db.refresh(demande)
        return DemandeRead.model_validate(demande)

    def list_demandes(self, db: Session) -> list[DemandeRead]:
        demandes = db.scalars(
            select(Demande)
            .options(selectinload(Demande.events))
            .order_by(Demande.created_at.desc(), Demande.id.desc())
        ).all()
        return [DemandeRead.model_validate(item) for item in demandes]

    def get_demande(self, db: Session, demande_id: int) -> Demande:
        demande = db.get(Demande, demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
        return demande

    def update_status(
        self,
        db: Session,
        demande_id: int,
        new_status: DemandeStatus,
        actor_user: User | None = None,
    ) -> DemandeRead:
        demande = self.get_demande(db, demande_id)
        previous_status = demande.status
        if previous_status == new_status:
            return DemandeRead.model_validate(demande)

        demande.status = new_status
        record_demande_event(
            db,
            demande,
            event_type=new_status.value,
            actor_user=actor_user,
            previous_status=previous_status.value,
            new_status=new_status.value,
        )
        db.commit()
        db.refresh(demande)
        return DemandeRead.model_validate(demande)


demandes_service = DemandesService()
