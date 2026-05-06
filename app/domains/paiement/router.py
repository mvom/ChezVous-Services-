from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.domains.paiement.repository import SqlAlchemyPaiementsRepository
from app.domains.paiement.schemas import PaiementCreate, PaiementRead, PaiementUpdateStatus
from app.domains.paiement.service import PaiementsService
from app.schemas.user import UserRole


router = APIRouter(prefix="/paiements", tags=["Paiements"])


@router.post("", response_model=PaiementRead, status_code=status.HTTP_201_CREATED)
def create_paiement(
    payload: PaiementCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.CLIENT, UserRole.ADMIN)),
) -> PaiementRead:
    return PaiementsService(SqlAlchemyPaiementsRepository(db)).create_paiement(payload)


@router.get("", response_model=list[PaiementRead])
def list_paiements(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PaiementRead]:
    return PaiementsService(SqlAlchemyPaiementsRepository(db)).list_paiements()


@router.patch("/{paiement_id}/status", response_model=PaiementRead)
def update_paiement_status(
    paiement_id: int,
    payload: PaiementUpdateStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> PaiementRead:
    return PaiementsService(SqlAlchemyPaiementsRepository(db)).update_status(paiement_id, payload.status)
