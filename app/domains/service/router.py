from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_role, get_current_user, get_db, require_roles
from app.db.models import User
from app.domains.service.repository import SqlAlchemyServicesRepository
from app.domains.service.schemas import ServiceCreate, ServiceRead
from app.domains.service.service import ServicesService
from app.schemas.user import UserRole


router = APIRouter(prefix="/services", tags=["Services"])


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE, UserRole.ADMIN)),
    active_role: UserRole = Depends(get_current_active_role),
) -> ServiceRead:
    if active_role == UserRole.PRESTATAIRE and payload.prestataire_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="prestataire_id invalide")
    return ServicesService(SqlAlchemyServicesRepository(db)).create_service(payload)


@router.get("", response_model=list[ServiceRead])
def list_services(
    prestataire_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ServiceRead]:
    return ServicesService(SqlAlchemyServicesRepository(db)).list_services(prestataire_id=prestataire_id)
