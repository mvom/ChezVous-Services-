from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.domains.auth.repository import AuthRepository, SqlAlchemyAuthRepository


class BaseAuthService:
    """Comportement commun à AuthService et AdminService."""

    def __init__(self, repository_factory: Callable[[Session], AuthRepository] | None = None) -> None:
        self._repository_factory = repository_factory or (lambda db: SqlAlchemyAuthRepository(db))

    def _repo(self, db: Session) -> AuthRepository:
        return self._repository_factory(db)

    def _assert_username_available(self, db: Session, username: str) -> None:
        repo = self._repo(db)
        existing = repo.get_user_id_by_username(username)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ce nom d'utilisateur existe deja. Choisissez-en un autre.",
            )
