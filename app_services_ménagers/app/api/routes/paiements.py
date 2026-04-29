from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.paiement import PaiementCreate, PaiementRead, PaiementUpdateStatus
from app.schemas.user import UserRole
from app.services.paiements_service import paiements_service


router = APIRouter(prefix="/paiements", tags=["Paiements"])


@router.post("", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
def create_paiement(
    payload: PaiementCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> PaiementRead:
    return paiements_service.create_paiement(db, payload)


@router.get("", response_model=list[PaiementRead])
def list_paiements(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PaiementRead]:
    return paiements_service.list_paiements(db)


@router.patch("/{paiement_id}/status", response_model=PaiementRead)
def update_paiement_status(
    paiement_id: int,
    payload: PaiementUpdateStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> PaiementRead:
    return paiements_service.update_status(db, paiement_id, payload.status)
