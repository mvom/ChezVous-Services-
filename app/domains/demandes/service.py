from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Demande, Notification, User
from app.domains.demandes.repository import DemandesRepository, SqlAlchemyDemandesRepository
from app.schemas.demande import DemandeClientUpdate, DemandeCreate, DemandeRead, DemandeStatus
from app.schemas.user import UserRole


def _actor_label(actor_user: User | None, actor_role: UserRole | None = None) -> str | None:
    if actor_user is None:
        return None
    resolved_role = actor_role or actor_user.role
    full_name = f"{actor_user.first_name} {actor_user.last_name}".strip()
    if full_name:
        return f"{full_name} ({resolved_role.value})"
    return f"Utilisateur #{actor_user.id} ({resolved_role.value})"


def record_demande_event(
    repo: DemandesRepository,
    demande: Demande,
    event_type: str,
    actor_user: User | None,
    actor_role: UserRole | None = None,
    previous_status: str | None = None,
    new_status: str | None = None,
) -> None:
    repo.add_demande_event(
        demande_id=demande.id,
        event_type=event_type,
        previous_status=previous_status,
        new_status=new_status,
        actor_user_id=actor_user.id if actor_user else None,
        actor_label=_actor_label(actor_user, actor_role),
    )


class DemandesService:
    def __init__(
        self,
        repository_factory: Callable[[Session], DemandesRepository] | None = None,
        zone_notifier: Callable[[Session, Demande], None] | None = None,
    ) -> None:
        self._repository_factory = repository_factory or (lambda db: SqlAlchemyDemandesRepository(db))
        self._zone_notifier = zone_notifier or _notify_prestataires_in_zone

    def _repo(self, db: Session) -> DemandesRepository:
        return self._repository_factory(db)

    def create_demande(
        self,
        db: Session,
        payload: DemandeCreate,
        actor_user: User | None = None,
        actor_role: UserRole | None = None,
    ) -> DemandeRead:
        repo = self._repo(db)
        client = repo.get_client(payload.client_id)
        if client is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client invalide")

        ville = payload.ville.strip()
        arrondissement = payload.arrondissement.strip()
        quartier = payload.quartier.strip()
        composed_location = ", ".join([ville, arrondissement, quartier])

        demande = Demande(
            client_id=payload.client_id,
            category=payload.category.value if hasattr(payload.category, "value") else str(payload.category),
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
            sub_services=payload.sub_services if payload.sub_services else None,
            status=DemandeStatus.OUVERTE,
        )
        repo.add_demande(demande)
        repo.flush()
        record_demande_event(
            repo,
            demande,
            event_type="cree",
            actor_user=actor_user,
            actor_role=actor_role,
            previous_status=None,
            new_status=DemandeStatus.OUVERTE.value,
        )
        repo.commit()
        repo.refresh_demande(demande)

        # Notify prestataires whose zone preference matches this demande — fire-and-forget
        self._zone_notifier(db, demande)

        return DemandeRead.model_validate(demande)

    def update_by_client(
        self,
        db: Session,
        demande_id: int,
        payload: DemandeClientUpdate,
        actor_user: User,
        actor_role: UserRole | None = None,
    ) -> DemandeRead:
        repo = self._repo(db)
        resolved_role = actor_role or actor_user.role
        demande = self.get_demande(db, demande_id)
        if resolved_role == UserRole.CLIENT and demande.client_id != actor_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez modifier que vos demandes")
        if resolved_role == UserRole.CLIENT and demande.status != DemandeStatus.OUVERTE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Modification impossible: la demande est deja en cours de prise en charge",
            )

        ville = payload.ville.strip()
        arrondissement = payload.arrondissement.strip()
        quartier = payload.quartier.strip()
        composed_location = ", ".join([ville, arrondissement, quartier])

        demande.description = payload.description
        demande.category = payload.category.value if hasattr(payload.category, "value") else str(payload.category)
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
        demande.sub_services = payload.sub_services if payload.sub_services else None

        record_demande_event(
            repo,
            demande,
            event_type="modifiee",
            actor_user=actor_user,
            actor_role=resolved_role,
            previous_status=demande.status.value,
            new_status=demande.status.value,
        )

        repo.commit()
        repo.refresh_demande(demande)
        return DemandeRead.model_validate(demande)

    def list_demandes(self, db: Session) -> list[DemandeRead]:
        repo = self._repo(db)
        demandes = repo.list_demandes_with_events()
        return [DemandeRead.model_validate(item) for item in demandes]

    def get_demande(self, db: Session, demande_id: int) -> Demande:
        repo = self._repo(db)
        demande = repo.get_demande(demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")
        return demande

    def update_status(
        self,
        db: Session,
        demande_id: int,
        new_status: DemandeStatus,
        actor_user: User | None = None,
        actor_role: UserRole | None = None,
    ) -> DemandeRead:
        repo = self._repo(db)
        demande = self.get_demande(db, demande_id)
        previous_status = demande.status
        if previous_status == new_status:
            return DemandeRead.model_validate(demande)

        demande.status = new_status
        record_demande_event(
            repo,
            demande,
            event_type=new_status.value,
            actor_user=actor_user,
            actor_role=actor_role,
            previous_status=previous_status.value,
            new_status=new_status.value,
        )
        repo.commit()
        repo.refresh_demande(demande)
        return DemandeRead.model_validate(demande)

    def cancel_by_client(
        self,
        db: Session,
        demande_id: int,
        actor_user: User,
        actor_role: UserRole | None = None,
    ) -> DemandeRead:
        resolved_role = actor_role or actor_user.role
        demande = self.get_demande(db, demande_id)
        if resolved_role == UserRole.CLIENT and demande.client_id != actor_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez annuler que vos demandes")
        if demande.status != DemandeStatus.OUVERTE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Annulation impossible: la demande n'est plus ouverte",
            )

        return self.update_status(
            db,
            demande_id,
            DemandeStatus.ANNULEE,
            actor_user=actor_user,
            actor_role=resolved_role,
        )


def _notify_prestataires_in_zone(db: Session, demande: Demande) -> None:
    """Create in-app notifications (and send emails) to prestataires whose zone matches the demande."""
    # Import here to avoid circular imports
    from app.domains.prestataires.service import prestataires_service
    from app.services.mail_service import mail_service

    location_parts = [demande.ville, demande.arrondissement, demande.quartier]
    location_str = ", ".join(p for p in location_parts if p)

    matched = prestataires_service.find_prestataires_in_zone(
        db,
        ville=demande.ville,
        arrondissement=demande.arrondissement,
        quartier=demande.quartier,
    )

    for prest, user in matched:
        notif = Notification(
            prestataire_id=prest.user_id,
            demande_id=demande.id,
            message=(
                f"Nouvelle demande #{demande.id} ({demande.category}) dans votre zone : {location_str}"
            ),
            is_read=False,
        )
        db.add(notif)

        try:
            mail_service.send_zone_demande_notification(
                to_email=user.email,
                first_name=user.first_name,
                demande_id=demande.id,
                location=location_str,
                category=demande.category,
            )
        except Exception:
            pass  # email failure must not block the response

    if matched:
        db.commit()


demandes_service = DemandesService()
