from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.domains.prestataires.service import prestataires_service
from app.schemas.prestataire import NotificationRead, PrestataireRead, PrestataireVerifyUpdate, VisibilityModeUpdate, ZonePreferenceUpdate
from app.schemas.user import UserRole


router = APIRouter(prefix="/prestataires", tags=["Prestataires"])


@router.get("", response_model=list[PrestataireRead])
def list_prestataires(
    verified_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PrestataireRead]:
    return prestataires_service.list_prestataires(db, verified_only=verified_only)


@router.patch("/me/visibility", response_model=PrestataireRead)
def update_my_visibility(
    payload: VisibilityModeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE)),
) -> PrestataireRead:
    return prestataires_service.update_visibility_mode(db, current_user.id, payload.visibility_mode)


@router.patch("/me/zone", response_model=PrestataireRead)
def update_my_zone_preference(
    payload: ZonePreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE)),
) -> PrestataireRead:
    return prestataires_service.update_zone_preference(db, current_user.id, payload)


@router.get("/me/notifications", response_model=list[NotificationRead])
def list_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE)),
) -> list[NotificationRead]:
    return prestataires_service.list_notifications(db, current_user.id)


@router.post("/me/notifications/read-all", status_code=204)
def mark_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PRESTATAIRE)),
) -> None:
    prestataires_service.mark_notifications_read(db, current_user.id)


@router.patch("/{prestataire_id}/verified", response_model=PrestataireRead)
def update_prestataire_verified(
    prestataire_id: int,
    payload: PrestataireVerifyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> PrestataireRead:
    return prestataires_service.update_verified(db, prestataire_id, payload.verified)
