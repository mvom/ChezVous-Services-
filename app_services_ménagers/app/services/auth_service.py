from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Client, Prestataire, User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserRead, UserRole


class AuthService:
    def register(self, db: Session, payload: UserCreate) -> UserRead:
        user = User(
            full_name=payload.full_name,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        db.add(user)
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce numero de telephone existe deja",
            ) from exc

        if payload.role == UserRole.CLIENT:
            db.add(Client(user_id=user.id))
        elif payload.role == UserRole.PRESTATAIRE:
            db.add(Prestataire(user_id=user.id, rating=0.0, verified=False))

        db.commit()
        db.refresh(user)
        return UserRead.model_validate(user)

    def login(self, db: Session, payload: LoginRequest) -> TokenResponse:
        user = db.scalar(select(User).where(User.phone == payload.phone))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants invalides",
            )
        token = create_access_token(user_id=user.id, role=user.role.value)
        return TokenResponse(access_token=token)

    def list_users(self, db: Session) -> list[UserRead]:
        users = db.scalars(select(User).order_by(User.id)).all()
        return [UserRead.model_validate(item) for item in users]


auth_service = AuthService()
