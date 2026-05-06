import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import Client, Prestataire, User
from app.db.session import SessionLocal
from app.schemas.user import UserRole


def _env(name: str, default: str) -> str:
    return os.getenv(name, default).strip()


def _upsert_user(
    *,
    first_name: str,
    last_name: str,
    username: str,
    email: str,
    address: str,
    phone: str,
    password: str,
    role: UserRole,
) -> User:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.role == role, User.phone == phone))
        if user is None:
            user = User(
                first_name=first_name,
                last_name=last_name,
                username=username,
                email=email,
                address=address,
                phone=phone,
                password_hash=hash_password(password),
                role=role,
            )
            db.add(user)
            db.flush()
            print(f"[seed] created {role.value}: {username}")
        else:
            user.first_name = first_name
            user.last_name = last_name
            user.username = username
            user.email = email
            user.address = address
            user.password_hash = hash_password(password)
            print(f"[seed] updated {role.value}: {username}")

        if role == UserRole.CLIENT and db.get(Client, user.id) is None:
            db.add(Client(user_id=user.id))

        if role == UserRole.PRESTATAIRE and db.get(Prestataire, user.id) is None:
            db.add(Prestataire(user_id=user.id, rating=0.0, verified=False))

        db.commit()
        db.refresh(user)
        return user


def run() -> None:
    _upsert_user(
        first_name=_env("SEED_ADMIN_FIRST_NAME", "Admin"),
        last_name=_env("SEED_ADMIN_LAST_NAME", "Systeme"),
        username=_env("SEED_ADMIN_USERNAME", "admin.demo"),
        email=_env("SEED_ADMIN_EMAIL", "admin.demo@example.com"),
        address=_env("SEED_ADMIN_ADDRESS", "Yaounde, Bastos"),
        phone=_env("SEED_ADMIN_PHONE", "+237 699 000 001"),
        password=_env("SEED_ADMIN_PASSWORD", "password123"),
        role=UserRole.ADMIN,
    )

    _upsert_user(
        first_name=_env("SEED_CLIENT_FIRST_NAME", "Alice"),
        last_name=_env("SEED_CLIENT_LAST_NAME", "Client"),
        username=_env("SEED_CLIENT_USERNAME", "alice.client.demo"),
        email=_env("SEED_CLIENT_EMAIL", "alice.client.demo@example.com"),
        address=_env("SEED_CLIENT_ADDRESS", "Douala, Akwa"),
        phone=_env("SEED_CLIENT_PHONE", "+237 699 000 002"),
        password=_env("SEED_CLIENT_PASSWORD", "password123"),
        role=UserRole.CLIENT,
    )

    _upsert_user(
        first_name=_env("SEED_PRESTATAIRE_FIRST_NAME", "Bob"),
        last_name=_env("SEED_PRESTATAIRE_LAST_NAME", "Presta"),
        username=_env("SEED_PRESTATAIRE_USERNAME", "bob.presta.demo"),
        email=_env("SEED_PRESTATAIRE_EMAIL", "bob.presta.demo@example.com"),
        address=_env("SEED_PRESTATAIRE_ADDRESS", "Douala, Akwa"),
        phone=_env("SEED_PRESTATAIRE_PHONE", "+237 699 000 003"),
        password=_env("SEED_PRESTATAIRE_PASSWORD", "password123"),
        role=UserRole.PRESTATAIRE,
    )

    print("[seed] done")


if __name__ == "__main__":
    run()