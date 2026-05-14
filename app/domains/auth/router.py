from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_role, get_current_user, get_db, require_roles
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.models import User
from app.domains.auth.admin_service import admin_service
from app.domains.auth.service import auth_service
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import (
    AddRoleRequest,
    AdminPasswordResetRequest,
    AdminRoleUpdateRequest,
    AuthRolesResponse,
    AvatarUpdate,
    LoginRequest,
    PaginatedAuditEvents,
    SessionResponse,
    SwitchRoleRequest,
    TokenResponse,
    UnregisterRequest,
    UserCreate,
    UserRead,
    UserRole,
)


router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expire_minutes * 60,
        path="/api/v1",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    return auth_service.register(db, payload)


@router.post("/login", response_model=SessionResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> SessionResponse:
    token, session = auth_service.login(db, payload)
    _set_auth_cookie(response, token)
    return session


@router.post("/refresh", response_model=SessionResponse)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_role: UserRole = Depends(get_current_active_role),
) -> SessionResponse:
    token, session = auth_service.refresh_token(db, current_user, active_role)
    _set_auth_cookie(response, token)
    return session


@router.get("/me/roles", response_model=AuthRolesResponse)
def get_my_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_role: UserRole = Depends(get_current_active_role),
) -> AuthRolesResponse:
    return auth_service.get_my_roles(db, current_user, active_role)


@router.post("/switch-role", response_model=SessionResponse)
def switch_role(
    payload: SwitchRoleRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    token, session = auth_service.switch_role(db, current_user, payload)
    _set_auth_cookie(response, token)
    return session


@router.post("/add-role", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def add_second_role(
    payload: AddRoleRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    token, session = auth_service.add_second_role(db, current_user, payload)
    _set_auth_cookie(response, token)
    return session


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/api/v1")


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserRead]:
    return admin_service.list_users(db)


@router.patch("/admin/users/{user_id}/reset-password", status_code=status.HTTP_200_OK)
def admin_reset_user_password(
    user_id: int,
    payload: AdminPasswordResetRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return admin_service.admin_reset_password(db, current_admin, user_id, payload)


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
    return admin_service.list_audit_events(
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
    return admin_service.admin_update_user_role(db, current_admin, user_id, payload)


@router.post("/admin/users/{user_id}/add-role", status_code=status.HTTP_201_CREATED)
def admin_add_role(
    user_id: int,
    payload: AddRoleRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return admin_service.admin_add_role(db, current_admin, user_id, payload)


@router.post("/admin/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def admin_create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> UserRead:
    return admin_service.admin_create_user(db, current_admin, payload)


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_200_OK)
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_roles(UserRole.ADMIN)),
) -> dict[str, str]:
    return admin_service.admin_delete_user(db, current_admin, user_id)


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
