from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.service import ServiceCreate, ServiceRead
from app.schemas.user import UserRole
from app.services.services_service import services_service


router = APIRouter(prefix="/services", tags=["Services"])


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
def create_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE, UserRole.ADMIN)),
) -> ServiceRead:
    if current_user.role == UserRole.PRESTATAIRE and payload.prestataire_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="prestataire_id invalide")
    return services_service.create_service(db, payload)


@router.get("", response_model=list[ServiceRead])
def list_services(
    prestataire_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ServiceRead]:
    return services_service.list_services(db, prestataire_id=prestataire_id)
