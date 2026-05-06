from unittest.mock import MagicMock

import pytest

from app.core.security import hash_password
from app.schemas.user import LoginRequest, UserRole
from app.domains.auth.service import AuthService


class FakeAuthRepository:
    def __init__(self) -> None:
        self.user = MagicMock()
        self.user.id = 7
        self.user.username = "alice"
        self.user.role = UserRole.CLIENT
        self.user.password_hash = hash_password("password123")

    def get_user_id_by_username(self, username: str):
        return 7 if username == "alice" else None

    def list_roles_for_user(self, user_id: int):
        return [UserRole.CLIENT, UserRole.PRESTATAIRE] if user_id == 7 else []

    def list_users_by_login_identifier(self, identifier: str):
        if identifier in {"alice", "+237 699 000 111"}:
            return [self.user]
        return []

    def list_users_by_login_identifier_and_role(self, identifier: str, role: UserRole):
        users = self.list_users_by_login_identifier(identifier)
        if not users:
            return []
        if role in self.list_roles_for_user(users[0].id):
            return users
        return []

    def add_user(self, user):
        return

    def flush(self):
        return

    def rollback(self):
        return

    def add_client_profile(self, user_id: int):
        return

    def add_prestataire_profile(self, user_id: int):
        return

    def add_user_role_link(self, user_id: int, role: UserRole):
        return

    def commit(self):
        return

    def refresh_user(self, user):
        return

    def list_users(self):
        return [self.user]

    def get_client_profile(self, user_id: int):
        return None

    def get_prestataire_profile(self, user_id: int):
        return None

    def list_badges_for_user(self, user_id: int):
        return []

    def find_role_link(self, user_id: int, role: UserRole):
        return None


@pytest.mark.unit
def test_auth_service_login_works_with_fake_repository_without_db_session():
    fake_repo = FakeAuthRepository()
    service = AuthService(repository_factory=lambda _db: fake_repo)

    token, session = service.login(
        db=None,
        payload=LoginRequest(phone="alice", password="password123"),
    )

    assert isinstance(token, str)
    assert session.sub == "7"
    assert session.username == "alice"
    assert session.active_role == UserRole.CLIENT
    assert sorted(session.available_roles) == [UserRole.CLIENT, UserRole.PRESTATAIRE]
