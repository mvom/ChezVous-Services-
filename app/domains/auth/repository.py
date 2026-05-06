from typing import Protocol

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import Badge, Client, Prestataire, User, UserRoleLink
from app.schemas.user import UserRole


class AuthRepository(Protocol):
    def get_user_id_by_username(self, username: str) -> int | None:
        ...

    def list_roles_for_user(self, user_id: int) -> list[UserRole]:
        ...

    def list_users_by_login_identifier(self, identifier: str) -> list[User]:
        ...

    def list_users_by_login_identifier_and_role(self, identifier: str, role: UserRole) -> list[User]:
        ...

    def add_user(self, user: User) -> None:
        ...

    def flush(self) -> None:
        ...

    def rollback(self) -> None:
        ...

    def add_client_profile(self, user_id: int) -> None:
        ...

    def add_prestataire_profile(self, user_id: int) -> None:
        ...

    def add_user_role_link(self, user_id: int, role: UserRole) -> None:
        ...

    def commit(self) -> None:
        ...

    def refresh_user(self, user: User) -> None:
        ...

    def list_users(self) -> list[User]:
        ...

    def get_client_profile(self, user_id: int) -> Client | None:
        ...

    def get_prestataire_profile(self, user_id: int) -> Prestataire | None:
        ...

    def list_badges_for_user(self, user_id: int) -> list[Badge]:
        ...

    def find_role_link(self, user_id: int, role: UserRole) -> UserRoleLink | None:
        ...

    def get_user(self, user_id: int) -> User | None:
        ...

    def delete_user(self, user: User) -> None:
        ...

    def delete_client_profile(self, profile: Client) -> None:
        ...

    def delete_prestataire_profile(self, profile: Prestataire) -> None:
        ...

    def delete_role_link(self, link: UserRoleLink) -> None:
        ...


class SqlAlchemyAuthRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_id_by_username(self, username: str) -> int | None:
        return self.db.scalar(select(User.id).where(User.username == username))

    def list_roles_for_user(self, user_id: int) -> list[UserRole]:
        return list(
            self.db.scalars(select(UserRoleLink.role).where(UserRoleLink.user_id == user_id).order_by(UserRoleLink.id.asc())).all()
        )

    def list_users_by_login_identifier(self, identifier: str) -> list[User]:
        stmt = select(User).where(or_(User.phone == identifier, User.username == identifier))
        return self.db.scalars(stmt.order_by(User.id.asc())).all()

    def list_users_by_login_identifier_and_role(self, identifier: str, role: UserRole) -> list[User]:
        stmt = select(User).where(
            or_(User.phone == identifier, User.username == identifier),
            or_(
                User.role == role,
                User.id.in_(select(UserRoleLink.user_id).where(UserRoleLink.role == role)),
            ),
        )
        return self.db.scalars(stmt.order_by(User.id.asc())).all()

    def add_user(self, user: User) -> None:
        self.db.add(user)

    def flush(self) -> None:
        self.db.flush()

    def rollback(self) -> None:
        self.db.rollback()

    def add_client_profile(self, user_id: int) -> None:
        self.db.add(Client(user_id=user_id))

    def add_prestataire_profile(self, user_id: int) -> None:
        self.db.add(Prestataire(user_id=user_id, rating=0.0, verified=False))

    def add_user_role_link(self, user_id: int, role: UserRole) -> None:
        self.db.add(UserRoleLink(user_id=user_id, role=role))

    def commit(self) -> None:
        self.db.commit()

    def refresh_user(self, user: User) -> None:
        self.db.refresh(user)

    def list_users(self) -> list[User]:
        return self.db.scalars(select(User).order_by(User.id)).all()

    def get_client_profile(self, user_id: int) -> Client | None:
        return self.db.get(Client, user_id)

    def get_prestataire_profile(self, user_id: int) -> Prestataire | None:
        return self.db.get(Prestataire, user_id)

    def list_badges_for_user(self, user_id: int) -> list[Badge]:
        return self.db.scalars(
            select(Badge)
            .where(Badge.user_id == user_id)
            .order_by(Badge.awarded_at.desc(), Badge.id.desc())
        ).all()

    def find_role_link(self, user_id: int, role: UserRole) -> UserRoleLink | None:
        return self.db.scalar(
            select(UserRoleLink).where(
                UserRoleLink.user_id == user_id,
                UserRoleLink.role == role,
            )
        )

    def get_user(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def delete_user(self, user: User) -> None:
        self.db.delete(user)

    def delete_client_profile(self, profile: Client) -> None:
        self.db.delete(profile)

    def delete_prestataire_profile(self, profile: Prestataire) -> None:
        self.db.delete(profile)

    def delete_role_link(self, link: UserRoleLink) -> None:
        self.db.delete(link)
