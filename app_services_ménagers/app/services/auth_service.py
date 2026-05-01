from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Badge, Client, Prestataire, User
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import LoginRequest, TokenResponse, UnregisterRequest, UserCreate, UserRead, UserRole
from app.services.mail_service import mail_service


class AuthService:
    def register(self, db: Session, payload: UserCreate) -> UserRead:
        if payload.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creation de compte admin interdite via l'inscription publique",
            )

        user = User(
            first_name=payload.first_name,
            last_name=payload.last_name,
            username=payload.username,
            email=payload.email,
            address=payload.address,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            role=payload.role,
        )
        db.add(user)
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            detail = str(getattr(exc, "orig", exc)).lower()
            if "role" in detail and "phone" in detail:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ce numero de telephone existe deja pour le role {payload.role.value}",
                ) from exc
            if "role" in detail and "email" in detail:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cette adresse email existe deja pour le role {payload.role.value}",
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Un compte avec ces informations existe deja",
            ) from exc

        if payload.role == UserRole.CLIENT:
            db.add(Client(user_id=user.id))
        elif payload.role == UserRole.PRESTATAIRE:
            db.add(Prestataire(user_id=user.id, rating=0.0, verified=False))

        mail_service.send_registration_confirmation(
            to_email=payload.email,
            first_name=payload.first_name,
            role=payload.role.value,
        )

        db.commit()
        db.refresh(user)
        return UserRead.model_validate(user)

    def login(self, db: Session, payload: LoginRequest) -> TokenResponse:
        user = db.scalar(select(User).where(or_(User.phone == payload.phone, User.username == payload.phone)))
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Vous n'avez pas encore de compte. Inscrivez-vous d'abord.",
            )
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants invalides",
            )
        token = create_access_token(user_id=user.id, role=user.role.value, username=user.username)
        return TokenResponse(access_token=token)

    def list_users(self, db: Session) -> list[UserRead]:
        users = db.scalars(select(User).order_by(User.id)).all()
        return [UserRead.model_validate(item) for item in users]

    def unregister(self, db: Session, current_user: User, payload: UnregisterRequest) -> dict[str, str]:
        if not verify_password(payload.password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Mot de passe invalide",
            )

        mail_service.send_unregistration_confirmation(
            to_email=current_user.email,
            first_name=current_user.first_name,
            role=current_user.role.value,
        )

        db.delete(current_user)
        db.commit()
        return {"detail": "Compte supprime. Un email de confirmation a ete envoye."}

    def get_client_loyalty(self, db: Session, current_user: User) -> LoyaltyRead:
        client = db.get(Client, current_user.id)
        if client is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil client introuvable")

        completed = int(client.completed_missions_count)
        points = int(client.loyalty_points)
        if completed < 5:
            next_milestone = 5
        elif completed < 10:
            next_milestone = 10
        elif completed < 20:
            next_milestone = 20
        else:
            next_milestone = ((completed // 10) + 1) * 10

        progress_percent = min(100, round((completed / next_milestone) * 100)) if next_milestone > 0 else 100
        return LoyaltyRead(
            loyalty_points=points,
            completed_missions_count=completed,
            next_milestone=next_milestone,
            progress_percent=progress_percent,
        )

    def get_user_badges(self, db: Session, current_user: User) -> list[BadgeRead]:
        badges = db.scalars(
            select(Badge)
            .where(Badge.user_id == current_user.id)
            .order_by(Badge.awarded_at.desc(), Badge.id.desc())
        ).all()
        return [BadgeRead.model_validate(item) for item in badges]


auth_service = AuthService()
