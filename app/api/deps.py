from collections.abc import Generator

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.models import User, UserRoleLink
from app.db.session import get_db as _get_db
from app.schemas.user import UserRole


def get_db() -> Generator[Session, None, None]:
    yield from _get_db()


def get_token_payload(
    access_token: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
    )
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif access_token:
        token = access_token
    if not token:
        raise auth_error
    try:
        return decode_token(token)
    except ValueError:
        raise auth_error


def get_current_active_role(payload: dict = Depends(get_token_payload)) -> UserRole:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
    )
    try:
        raw_role = str(payload.get("role") or "").strip().lower()
        return UserRole(raw_role)
    except ValueError:
        raise auth_error


def get_current_user(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> User:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
    )
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise auth_error

    user = db.get(User, user_id)
    if user is None:
        raise auth_error
    return user


def require_roles(*allowed_roles: UserRole):
    def role_dependency(
        current_user: User = Depends(get_current_user),
        active_role: UserRole = Depends(get_current_active_role),
        db: Session = Depends(get_db),
    ) -> User:
        available_roles = set(
            db.scalars(select(UserRoleLink.role).where(UserRoleLink.user_id == current_user.id)).all()
        )
        if not available_roles:
            available_roles = {current_user.role}

        if active_role not in available_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role actif invalide pour cet utilisateur",
            )

        if active_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acces refuse pour ce role",
            )
        return current_user

    return role_dependency
