import pytest

from app.core.security import hash_password
from app.db.models import User
from app.schemas.user import UserRole
from tests.conftest import login_user, register_user


def create_admin(db_session) -> User:
    admin = User(
        first_name="Admin",
        last_name="Verifier",
        username="admin.verifier",
        email="admin.verifier@example.com",
        address="Douala, Akwa",
        phone="+237 699 800 700",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.mark.integration
def test_admin_can_mark_provider_as_verified(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Provider Verify",
        phone="677000321",
        password="password123",
        role="prestataire",
    )

    admin_token = login_user(client, phone="699800700", password="password123")

    response = client.patch(
        "/api/v1/prestataires/2/verified",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"verified": True},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user_id"] == 2
    assert body["verified"] is True

    listing = client.get(
        "/api/v1/prestataires",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert listing.status_code == 200, listing.text
    assert listing.json()[0]["verified"] is True


@pytest.mark.integration
def test_non_admin_cannot_mark_provider_as_verified(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Provider Locked",
        phone="677000654",
        password="password123",
        role="prestataire",
    )
    register_user(
        client,
        full_name="Client Blocked",
        phone="688000999",
        password="password123",
        role="client",
    )

    client_token = login_user(client, phone="688000999", password="password123")

    forbidden = client.patch(
        "/api/v1/prestataires/2/verified",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"verified": True},
    )

    assert forbidden.status_code == 403


@pytest.mark.integration
def test_admin_gets_404_when_provider_does_not_exist(client, db_session):
    create_admin(db_session)
    admin_token = login_user(client, phone="699800700", password="password123")

    missing = client.patch(
        "/api/v1/prestataires/999/verified",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"verified": True},
    )

    assert missing.status_code == 404
    assert missing.json()["detail"] == "Prestataire introuvable"