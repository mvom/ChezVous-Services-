from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.db.models import User
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import AvatarUpdate, LoginRequest, TokenResponse, UnregisterRequest, UserCreate, UserRead, UserRole
from app.services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    return auth_service.register(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return auth_service.login(db, payload)


@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
) -> list[UserRead]:
    return auth_service.list_users(db)


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
