from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_role, get_current_user, get_db, require_roles
from app.db.models import Demande, User
from app.domains.demandes.service import demandes_service
from app.schemas.demande import DemandeClientUpdate, DemandeCreate, DemandeRead, DemandeUpdateStatus
from app.schemas.matching import MatchingResult
from app.schemas.user import UserRole
from app.services.matching_service import matching_service


router = APIRouter(prefix="/demandes", tags=["Demandes"])


@router.post("", response_model=DemandeRead, status_code=status.HTTP_201_CREATED)
def create_demande(
    payload: DemandeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
    active_role: UserRole = Depends(get_current_active_role),
) -> DemandeRead:
    if active_role == UserRole.CLIENT and payload.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="client_id invalide")
    return demandes_service.create_demande(db, payload, actor_user=current_user, actor_role=active_role)


@router.get("", response_model=list[DemandeRead])
def list_demandes(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[DemandeRead]:
    return demandes_service.list_demandes(db)


@router.patch("/{demande_id}/status", response_model=DemandeRead)
def update_demande_status(
    demande_id: int,
    payload: DemandeUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE, UserRole.ADMIN)),
) -> DemandeRead:
    return demandes_service.update_status(db, demande_id, payload.status, actor_user=current_user)


@router.patch("/{demande_id}", response_model=DemandeRead)
def update_demande_by_client(
    demande_id: int,
    payload: DemandeClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
    active_role: UserRole = Depends(get_current_active_role),
) -> DemandeRead:
    return demandes_service.update_by_client(db, demande_id, payload, actor_user=current_user, actor_role=active_role)


@router.post("/{demande_id}/cancel", response_model=DemandeRead)
def cancel_demande_by_client(
    demande_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
    active_role: UserRole = Depends(get_current_active_role),
) -> DemandeRead:
    return demandes_service.cancel_by_client(db, demande_id, actor_user=current_user, actor_role=active_role)


@router.get("/{demande_id}/matching", response_model=MatchingResult)
def get_matching_for_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
    active_role: UserRole = Depends(get_current_active_role),
) -> MatchingResult:
    """
    Retourne les prestataires triés par score de compatibilité pour une demande donnée.
    Accessible au client propriétaire de la demande et à l'admin.
    """
    demande = db.get(Demande, demande_id)
    if demande is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demande introuvable")

    if active_role == UserRole.CLIENT and demande.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces refuse a cette demande")

    return matching_service.get_matching(db, demande_id)
