import json
from datetime import datetime
from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.log_config import get_logger
from app.core.security import hash_password
from app.db.models import AdminAuditEvent, Demande, Mission, Review, Service, User
from app.domains.auth._base_service import BaseAuthService
from app.domains.auth.repository import AuthRepository, SqlAlchemyAuthRepository
from app.schemas.user import (
    AddRoleRequest,
    AdminAuditEventRead,
    AdminPasswordResetRequest,
    AdminRoleUpdateRequest,
    PaginatedAuditEvents,
    UserCreate,
    UserRead,
    UserRole,
)

audit_logger = get_logger("app.auth.audit")


class AdminService(BaseAuthService):

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
                    int(db.scalar(select(func.count()).select_from(Service).where(Service.prestataire_id == user.id)) or 0) > 0,
                    int(db.scalar(select(func.count()).select_from(Mission).where(Mission.prestataire_id == user.id)) or 0) > 0,
                    int(db.scalar(select(func.count()).select_from(Review).where(Review.prestataire_id == user.id)) or 0) > 0,
                ]
            )
            if has_links:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Impossible de changer ce role: des donnees prestataire existent deja.",
                )

    def list_users(self, db: Session) -> list[UserRead]:
        repo = self._repo(db)
        users = repo.list_users()
        return [UserRead.model_validate(item) for item in users]

    def admin_create_user(self, db: Session, actor_user: User, payload: UserCreate) -> UserRead:
        repo = self._repo(db)
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

        repo.add_user(
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
        repo.commit()
        repo.refresh_user(user)

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
        repo = self._repo(db)
        user = repo.get_user(target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        previous_role = user.role
        next_role = payload.role

        if previous_role == next_role:
            return {"detail": f"Role deja positionne sur {next_role.value}."}

        self._assert_role_change_safe(db, user, next_role)

        if previous_role == UserRole.CLIENT:
            client = repo.get_client_profile(user.id)
            if client is not None:
                repo.delete_client_profile(client)
        elif previous_role == UserRole.PRESTATAIRE:
            prestataire = repo.get_prestataire_profile(user.id)
            if prestataire is not None:
                repo.delete_prestataire_profile(prestataire)

        if next_role == UserRole.CLIENT:
            repo.add_client_profile(user.id)
        elif next_role == UserRole.PRESTATAIRE:
            repo.add_prestataire_profile(user.id)

        old_link = repo.find_role_link(user.id, previous_role)
        if old_link is not None:
            repo.delete_role_link(old_link)

        existing_next_link = repo.find_role_link(user.id, next_role)
        if existing_next_link is None:
            repo.add_user_role_link(user.id, next_role)

        user.role = next_role
        repo.add_user(
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
        repo.commit()

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

    def admin_add_role(
        self,
        db: Session,
        actor_user: User,
        target_user_id: int,
        payload: AddRoleRequest,
    ) -> dict[str, str]:
        """Ajoute un rôle supplémentaire à un utilisateur sans modifier son rôle principal."""
        repo = self._repo(db)
        user = repo.get_user(target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        new_role = payload.role

        if new_role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="L'ajout du role admin est interdit.",
            )

        existing_link = repo.find_role_link(user.id, new_role)
        if existing_link is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"L'utilisateur a deja le role {new_role.value}.",
            )

        if new_role == UserRole.CLIENT and repo.get_client_profile(user.id) is None:
            repo.add_client_profile(user.id)
        elif new_role == UserRole.PRESTATAIRE and repo.get_prestataire_profile(user.id) is None:
            repo.add_prestataire_profile(user.id)

        repo.add_user_role_link(user.id, new_role)

        repo.add_user(
            AdminAuditEvent(
                event_type="admin_role_added",
                actor_user_id=actor_user.id,
                actor_role=actor_user.role.value,
                target_user_id=user.id,
                target_role=new_role.value,
                metadata_json=json.dumps(
                    {"added_role": new_role.value, "target_username": user.username},
                    ensure_ascii=True,
                ),
            )
        )
        repo.commit()

        audit_logger.info(
            "admin_role_added",
            extra={
                "event": "admin_role_added",
                "actor_user_id": actor_user.id,
                "actor_role": actor_user.role.value,
                "target_user_id": user.id,
                "added_role": new_role.value,
            },
        )
        return {"detail": f"Role {new_role.value} ajoute a l'utilisateur #{target_user_id}."}

    def admin_delete_user(self, db: Session, actor_user: User, target_user_id: int) -> dict[str, str]:
        repo = self._repo(db)
        user = repo.get_user(target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        if user.id == actor_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Suppression de son propre compte admin interdite",
            )

        snapshot_role = user.role.value
        snapshot_username = user.username
        repo.delete_user(user)

        try:
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
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
        repo = self._repo(db)
        user = repo.get_user(target_user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

        user.password_hash = hash_password(payload.new_password)
        repo.add_user(
            AdminAuditEvent(
                event_type="admin_password_reset",
                actor_user_id=actor_user.id,
                actor_role=actor_user.role.value,
                target_user_id=user.id,
                target_role=user.role.value,
                metadata_json=json.dumps({"target_username": user.username}, ensure_ascii=True),
            )
        )
        repo.commit()
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


admin_service = AdminService()
