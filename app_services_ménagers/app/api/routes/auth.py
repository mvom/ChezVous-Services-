from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import (
    AdminPasswordResetRequest,
    AdminRoleUpdateRequest,
    AvatarUpdate,
    LoginRequest,
    PaginatedAuditEvents,
    TokenResponse,
    UnregisterRequest,
    UserCreate,
    UserRead,
    UserRole,
)
from app.services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    return auth_service.register(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_service.login(db, payload)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(current_user: User = Depends(get_current_user)) -> TokenResponse:
    return auth_service.refresh_token(current_user)


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserRead]:
    return auth_service.list_users(db)


@router.patch("/admin/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def admin_reset_user_password(
    user_id: int,
    payload: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return auth_service.admin_reset_password(db, current_admin, user_id, payload)


@router.get("/admin/audit-events", response_model=PaginatedAuditEvents)
def list_admin_audit_events(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
    actor_user_id: int | None = Query(default=None),
    target_user_id: int | None = Query(default=None),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
) -> PaginatedAuditEvents:
    return auth_service.list_audit_events(
        db,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        from_date=from_date,
        to_date=to_date,
        page=page,
        size=size,
    )


@router.patch("/admin/users/{user_id}/role", status_code=status.HTTP_200_OK)
def admin_update_user_role(
    user_id: int,
    payload: AdminRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return auth_service.admin_update_user_role(db, current_admin, user_id, payload)


@router.post("/admin/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserRead:
    return auth_service.admin_create_user(db, current_admin, payload)


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_200_OK)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return auth_service.admin_delete_user(db, current_admin, user_id)


@router.post("/unregister", status_code=status.HTTP_200_OK)
def unregister(
    payload: UnregisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    return auth_service.unregister(db, current_user, payload)


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return current_user


@router.get("/me/loyalty", response_model=LoyaltyRead)
def get_me_loyalty(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CLIENT)),
) -> LoyaltyRead:
    return auth_service.get_client_loyalty(db, current_user)


@router.get("/me/badges", response_model=list[BadgeRead])
def get_me_badges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BadgeRead]:
    return auth_service.get_user_badges(db, current_user)


@router.patch("/me/avatar", response_model=UserRead)
def update_avatar(
    payload: AvatarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    if len(payload.avatar_url) > 3_000_000:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image trop grande (max 2 Mo)")
    current_user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user
