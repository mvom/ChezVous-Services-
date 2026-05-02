import json
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.log_config import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import AdminAuditEvent, Badge, Client, Demande, Mission, Prestataire, Review, Service, User
from app.schemas.gamification import BadgeRead, LoyaltyRead
from app.schemas.user import (
    AdminPasswordResetRequest,
    AdminAuditEventRead,
    LoginRequest,
    AdminRoleUpdateRequest,
    PaginatedAuditEvents,
    TokenResponse,
    UnregisterRequest,
    UserCreate,
    UserRead,
    UserRole,
)
from app.services.mail_service import mail_service


audit_logger = get_logger("app.auth.audit")


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
        stmt = select(User).where(or_(User.phone == payload.phone, User.username == payload.phone))
        if payload.role is not None:
            stmt = stmt.where(User.role == payload.role)

        users = db.scalars(stmt.order_by(User.id.asc())).all()
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
        token = create_access_token(user_id=user.id, role=user.role.value, username=user.username)
        return TokenResponse(access_token=token)

    def refresh_token(self, current_user: User) -> TokenResponse:
        token = create_access_token(user_id=current_user.id, role=current_user.role.value, username=current_user.username)
        return TokenResponse(access_token=token)

    def list_users(self, db: Session) -> list[UserRead]:
        users = db.scalars(select(User).order_by(User.id)).all()
        return [UserRead.model_validate(item) for item in users]

    def _assert_role_change_safe(self, db: Session, user: User, next_role: UserRole) -> None:
        if user.role == next_role:
            return

        if user.role == UserRole.CLIENT:
            has_links = any(
                [
                    int(db.scalar(select(func.count()).select_from(Demande).where(Demande.client_id == user.id)) or 0) > 0,
                    int(db.scalar(select(func.count()).select_from(Mission).where(Mission.client_id == user.id)) or 0) > 0,
                    int(db.scalar(select(func.count()).select_from(Review).where(Review.client_id == user.id)) or 0) > 0,
                ]
            )
            if has_links:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Impossible de changer ce role: des donnees client existent deja.",
                )

        if user.role == UserRole.PRESTATAIRE:
            has_links = any(
                [
                    int(db.scalar(select(func.count()).select_from(Service).where(Service.prestataire_id == user.id)) or 0)
                    > 0,
                    int(db.scalar(select(func.count()).select_from(Mission).where(Mission.prestataire_id == user.id)) or 0)
                    > 0,
                    int(db.scalar(select(func.count()).select_from(Review).where(Review.prestataire_id == user.id)) or 0) > 0,
                ]
            )
            if has_links:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Impossible de changer ce role: des donnees prestataire existent deja.",
                )

    def admin_create_user(self, db: Session, actor_user: User, payload: UserCreate) -> UserRead:
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

        db.add(
            AdminAuditEvent(
                event_type="admin_user_created",
                actor_user_id=actor_user.id,
                actor_role=actor_user.role.value,
                target_user_id=user.id,
                target_role=payload.role.value,
                metadata_json=json.dumps(
                    {"created_role": payload.role.value, "target_username": user.username},
                    ensure_ascii=True,
                ),
            )
        )
        db.commit()
        db.refresh(user)

        audit_logger.info(
            "admin_user_created",
            extra={
                "event": "admin_user_created",
                "actor_user_id": actor_user.id,
                "actor_role": actor_user.role.value,
                "target_user_id": user.id,
                "target_role": payload.role.value,
            },
        )
        return UserRead.model_validate(user)

    def admin_update_user_role(
        self,
        db: Session,
        actor_user: User,
        target_user_id: int,
        payload: AdminRoleUpdateRequest,
    ) -> dict[str, str]:
        user = db.get(User, target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        previous_role = user.role
        next_role = payload.role

        if previous_role == next_role:
            return {"detail": f"Role deja positionne sur {next_role.value}."}

        self._assert_role_change_safe(db, user, next_role)

        if previous_role == UserRole.CLIENT:
            client = db.get(Client, user.id)
            if client is not None:
                db.delete(client)
        elif previous_role == UserRole.PRESTATAIRE:
            prestataire = db.get(Prestataire, user.id)
            if prestataire is not None:
                db.delete(prestataire)

        if next_role == UserRole.CLIENT:
            db.add(Client(user_id=user.id))
        elif next_role == UserRole.PRESTATAIRE:
            db.add(Prestataire(user_id=user.id, rating=0.0, verified=False))

        user.role = next_role
        db.add(
            AdminAuditEvent(
                event_type="admin_role_change",
                actor_user_id=actor_user.id,
                actor_role=actor_user.role.value,
                target_user_id=user.id,
                target_role=next_role.value,
                metadata_json=json.dumps(
                    {"previous_role": previous_role.value, "new_role": next_role.value, "target_username": user.username},
                    ensure_ascii=True,
                ),
            )
        )
        db.commit()

        audit_logger.info(
            "admin_role_change",
            extra={
                "event": "admin_role_change",
                "actor_user_id": actor_user.id,
                "actor_role": actor_user.role.value,
                "target_user_id": user.id,
                "previous_role": previous_role.value,
                "target_role": next_role.value,
            },
        )
        return {"detail": f"Role de l'utilisateur #{target_user_id} mis a jour vers {next_role.value}."}

    def admin_delete_user(self, db: Session, actor_user: User, target_user_id: int) -> dict[str, str]:
        user = db.get(User, target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        if user.id == actor_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suppression de son propre compte admin interdite")

        snapshot_role = user.role.value
        snapshot_username = user.username
        db.delete(user)

        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Suppression impossible: ce compte est reference par des donnees metier.",
            ) from exc

        audit_logger.info(
            "admin_user_delete",
            extra={
                "event": "admin_user_delete",
                "actor_user_id": actor_user.id,
                "actor_role": actor_user.role.value,
                "target_user_id": target_user_id,
                "target_role": snapshot_role,
                "target_username": snapshot_username,
            },
        )
        return {"detail": f"Utilisateur #{target_user_id} supprime."}

    def admin_reset_password(
        self,
        db: Session,
        actor_user: User,
        target_user_id: int,
        payload: AdminPasswordResetRequest,
    ) -> dict[str, str]:
        user = db.get(User, target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        user.password_hash = hash_password(payload.new_password)
        db.add(
            AdminAuditEvent(
                event_type="admin_password_reset",
                actor_user_id=actor_user.id,
                actor_role=actor_user.role.value,
                target_user_id=user.id,
                target_role=user.role.value,
                metadata_json=json.dumps({"target_username": user.username}, ensure_ascii=True),
            )
        )
        db.commit()
        audit_logger.info(
            "admin_password_reset",
            extra={
                "event": "admin_password_reset",
                "actor_user_id": actor_user.id,
                "actor_role": actor_user.role.value,
                "target_user_id": user.id,
                "target_role": user.role.value,
            },
        )
        return {"detail": f"Mot de passe reinitialise pour l'utilisateur #{target_user_id}."}

    def list_audit_events(
        self,
        db: Session,
        *,
        actor_user_id: int | None = None,
        target_user_id: int | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedAuditEvents:
        stmt = select(AdminAuditEvent)
        if actor_user_id is not None:
            stmt = stmt.where(AdminAuditEvent.actor_user_id == actor_user_id)
        if target_user_id is not None:
            stmt = stmt.where(AdminAuditEvent.target_user_id == target_user_id)
        if from_date is not None:
            stmt = stmt.where(AdminAuditEvent.created_at >= from_date)
        if to_date is not None:
            stmt = stmt.where(AdminAuditEvent.created_at <= to_date)

        total = db.scalar(select(func.count()).select_from(stmt.subquery()))
        skip = (page - 1) * size
        rows = db.scalars(stmt.order_by(AdminAuditEvent.created_at.desc()).offset(skip).limit(size)).all()
        return PaginatedAuditEvents(
            total=total or 0,
            page=page,
            size=size,
            items=[AdminAuditEventRead.model_validate(r) for r in rows],
        )

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
