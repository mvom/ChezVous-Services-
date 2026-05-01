from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Client, Demande, DemandeEvent, User
from app.schemas.demande import DemandeClientUpdate, DemandeCreate, DemandeRead, DemandeStatus
from app.schemas.user import UserRole


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
            client_availability_mode=(
                payload.client_availability_mode.value
                if hasattr(payload.client_availability_mode, "value")
                else str(payload.client_availability_mode)
            ),
            client_availability_note=(payload.client_availability_note or "").strip() or None,
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

    def update_by_client(
        self,
        db: Session,
        demande_id: int,
        payload: DemandeClientUpdate,
        actor_user: User,
    ) -> DemandeRead:
        demande = self.get_demande(db, demande_id)
        if actor_user.role == UserRole.CLIENT and demande.client_id != actor_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez modifier que vos demandes")
        if actor_user.role == UserRole.CLIENT and demande.status != DemandeStatus.OUVERTE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Modification impossible: la demande est deja en cours de prise en charge",
            )

        ville = payload.ville.strip()
        arrondissement = payload.arrondissement.strip()
        quartier = payload.quartier.strip()
        composed_location = ", ".join([ville, arrondissement, quartier])

        demande.description = payload.description
        demande.ville = ville
        demande.arrondissement = arrondissement
        demande.quartier = quartier
        demande.location = (payload.location or composed_location).strip()
        demande.client_availability_mode = (
            payload.client_availability_mode.value
            if hasattr(payload.client_availability_mode, "value")
            else str(payload.client_availability_mode)
        )
        demande.client_availability_note = (payload.client_availability_note or "").strip() or None
        demande.priority = payload.priority.value if hasattr(payload.priority, "value") else str(payload.priority)

        record_demande_event(
            db,
            demande,
            event_type="modifiee",
            actor_user=actor_user,
            previous_status=demande.status.value,
            new_status=demande.status.value,
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

    def cancel_by_client(self, db: Session, demande_id: int, actor_user: User) -> DemandeRead:
        demande = self.get_demande(db, demande_id)
        if actor_user.role == UserRole.CLIENT and demande.client_id != actor_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez annuler que vos demandes")
        if demande.status != DemandeStatus.OUVERTE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Annulation impossible: la demande n'est plus ouverte",
            )

        return self.update_status(db, demande_id, DemandeStatus.ANNULEE, actor_user=actor_user)


demandes_service = DemandesService()
