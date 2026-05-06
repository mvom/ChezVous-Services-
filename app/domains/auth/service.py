from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.db.models import User
from app.domains.auth._base_service import BaseAuthService
from app.domains.auth.repository import AuthRepository, SqlAlchemyAuthRepository
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import (
    AddRoleRequest,
    AuthRolesResponse,
    LoginRequest,
    SessionResponse,
    SwitchRoleRequest,
    UnregisterRequest,
    UserCreate,
    UserRead,
    UserRole,
)
from app.services.mail_service import mail_service


class AuthService(BaseAuthService):

    def _available_roles(self, db: Session, user: User) -> list[UserRole]:
        repo = self._repo(db)
        roles = repo.list_roles_for_user(user.id)
        if not roles:
            return [user.role]
        deduped: list[UserRole] = []
        for role in roles:
            if role not in deduped:
                deduped.append(role)
        return deduped

    def _issue_token_response(self, db: Session, user: User, active_role: UserRole) -> tuple[str, SessionResponse]:
        available_roles = self._available_roles(db, user)
        if active_role not in available_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ce role n'est pas disponible pour cet utilisateur.",
            )
        token = create_access_token(user_id=user.id, role=active_role.value, username=user.username)
        payload = decode_token(token)
        session = SessionResponse(
            sub=str(user.id),
            role=active_role,
            username=user.username,
            exp=int(payload["exp"]),
            active_role=active_role,
            available_roles=available_roles,
            access_token=token,
        )
        return token, session

    def register(self, db: Session, payload: UserCreate) -> UserRead:
        repo = self._repo(db)
        if payload.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Creation de compte admin interdite via l'inscription publique",
            )

        self._assert_username_available(db, payload.username)

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
        repo.add_user(user)
        try:
            repo.flush()
        except IntegrityError as exc:
            repo.rollback()
            detail = str(getattr(exc, "orig", exc)).lower()
            if "username" in detail:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Ce nom d'utilisateur existe deja. Choisissez-en un autre.",
                ) from exc
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
            repo.add_client_profile(user.id)
        elif payload.role == UserRole.PRESTATAIRE:
            repo.add_prestataire_profile(user.id)

        repo.add_user_role_link(user.id, payload.role)

        mail_service.send_registration_confirmation(
            to_email=payload.email,
            first_name=payload.first_name,
            role=payload.role.value,
        )

        repo.commit()
        repo.refresh_user(user)
        return UserRead.model_validate(user)

    def login(self, db: Session, payload: LoginRequest) -> tuple[str, SessionResponse]:
        repo = self._repo(db)
        users = (
            repo.list_users_by_login_identifier_and_role(payload.phone, payload.role)
            if payload.role is not None
            else repo.list_users_by_login_identifier(payload.phone)
        )
        if not users:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Vous n'avez pas encore de compte. Inscrivez-vous d'abord.",
            )

        if len(users) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Plusieurs comptes correspondent a cet identifiant. Precisez le role pour vous connecter.",
            )

        user = users[0]
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Identifiants invalides",
            )
        active_role = payload.role or user.role
        return self._issue_token_response(db, user, active_role)

    def refresh_token(self, db: Session, current_user: User, active_role: UserRole) -> tuple[str, SessionResponse]:
        return self._issue_token_response(db, current_user, active_role)

    def get_my_roles(self, db: Session, current_user: User, active_role: UserRole) -> AuthRolesResponse:
        available_roles = self._available_roles(db, current_user)
        resolved_active = active_role if active_role in available_roles else current_user.role
        return AuthRolesResponse(active_role=resolved_active, available_roles=available_roles)

    def switch_role(self, db: Session, current_user: User, payload: SwitchRoleRequest) -> tuple[str, SessionResponse]:
        return self._issue_token_response(db, current_user, payload.role)

    def add_second_role(self, db: Session, current_user: User, payload: AddRoleRequest) -> tuple[str, SessionResponse]:
        """Flux secondaire self-service : ajoute un 2e role sans toucher au role principal."""
        repo = self._repo(db)
        new_role = payload.role

        if new_role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="L'ajout du role admin est interdit.",
            )

        existing_link = repo.find_role_link(current_user.id, new_role)
        if existing_link is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vous avez deja le role {new_role.value}.",
            )

        if new_role == UserRole.CLIENT and repo.get_client_profile(current_user.id) is None:
            repo.add_client_profile(current_user.id)
        elif new_role == UserRole.PRESTATAIRE and repo.get_prestataire_profile(current_user.id) is None:
            repo.add_prestataire_profile(current_user.id)

        repo.add_user_role_link(current_user.id, new_role)
        repo.commit()

        return self._issue_token_response(db, current_user, current_user.role)

    def unregister(self, db: Session, current_user: User, payload: UnregisterRequest) -> dict[str, str]:
        repo = self._repo(db)
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

        repo.delete_user(current_user)
        repo.commit()
        return {"detail": "Compte supprime. Un email de confirmation a ete envoye."}

    def get_client_loyalty(self, db: Session, current_user: User) -> LoyaltyRead:
        repo = self._repo(db)
        client = repo.get_client_profile(current_user.id)
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
        repo = self._repo(db)
        badges = repo.list_badges_for_user(current_user.id)
        return [BadgeRead.model_validate(item) for item in badges]


auth_service = AuthService()
