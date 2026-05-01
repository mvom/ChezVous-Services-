from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.mission import MissionAtRiskRead, MissionCreate, MissionRead, MissionUpdateStatus
from app.schemas.user import UserRole
from app.services.missions_service import missions_service
from app.tasks.tasks import sync_delay_risk_flags


router = APIRouter(prefix="/missions", tags=["Missions"])


@router.post("", response_model=MissionRead, status_code=status.HTTP_201_CREATED)
def create_mission(
    payload: MissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE, UserRole.ADMIN)),
) -> MissionRead:
    if current_user.role == UserRole.PRESTATAIRE and payload.prestataire_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="prestataire_id invalide")
    return missions_service.create_mission(db, payload, actor_user=current_user)


@router.get("", response_model=list[MissionRead])
def list_missions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[MissionRead]:
    return missions_service.list_missions(db)


@router.get("/at-risk", response_model=MissionAtRiskRead)
def list_at_risk_missions(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> MissionAtRiskRead:
    return MissionAtRiskRead.model_validate(sync_delay_risk_flags(db))


@router.patch("/{mission_id}/status", response_model=MissionRead)
def update_mission_status(
    mission_id: int,
    payload: MissionUpdateStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT, UserRole.PRESTATAIRE, UserRole.ADMIN)),
) -> MissionRead:
    return missions_service.update_status(db, mission_id, payload.status, actor_user=current_user)
