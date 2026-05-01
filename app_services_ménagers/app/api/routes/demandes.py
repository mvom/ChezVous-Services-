from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.demande import DemandeClientUpdate, DemandeCreate, DemandeRead, DemandeUpdateStatus
from app.schemas.matching import MatchingResult
from app.schemas.user import UserRole
from app.services.demandes_service import demandes_service
from app.services.matching_service import matching_service


router = APIRouter(prefix="/demandes", tags=["Demandes"])


@router.post("", response_model=DemandeRead, status_code=status.HTTP_201_CREATED)
def create_demande(
    payload: DemandeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> DemandeRead:
    if current_user.role == UserRole.CLIENT and payload.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="client_id invalide")
    return demandes_service.create_demande(db, payload, actor_user=current_user)


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
) -> DemandeRead:
    return demandes_service.update_by_client(db, demande_id, payload, actor_user=current_user)


@router.post("/{demande_id}/cancel", response_model=DemandeRead)
def cancel_demande_by_client(
    demande_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> DemandeRead:
    return demandes_service.cancel_by_client(db, demande_id, actor_user=current_user)


@router.get("/{demande_id}/matching", response_model=MatchingResult)
def get_matching_for_demande(
    demande_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> MatchingResult:
    """
    Retourne les prestataires triés par score de compatibilité pour une demande donnée.
    Accessible au client propriétaire de la demande et à l'admin.
    """
    return matching_service.get_matching(db, demande_id)
