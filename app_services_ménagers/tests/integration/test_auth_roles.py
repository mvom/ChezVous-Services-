import pytest

import json

from app.core.security import hash_password
from app.db.models import AdminAuditEvent, User
from app.schemas.user import UserRole
from tests.conftest import login_user, register_user


def create_admin(db_session) -> User:
    admin = User(
        first_name="Admin",
        last_name="Reset",
        username="admin.reset",
        email="admin.reset@example.com",
        address="Douala, Akwa",
        phone="+237 699 800 701",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.mark.integration
def test_auth_users_endpoint_requires_admin_role(client):
    register_user(
        client,
        full_name="Client User",
        phone="770000001",
        password="password123",
        role="client",
    )
    client_token = login_user(client, phone="770000001", password="password123")

    forbidden = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_public_register_admin_role_is_forbidden(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Admin",
            "last_name": "Blocked",
            "username": "admin.blocked",
            "email": "admin.blocked@example.com",
            "address": "Yaounde, Bastos",
            "phone": "+237 770 000 099",
            "password": "password123",
            "role": "admin",
        },
    )
    assert response.status_code == 403
    assert "interdite" in response.json()["detail"]


@pytest.mark.integration
def test_auth_users_endpoint_returns_only_registered_non_admin_users(client):
    register_user(
        client,
        full_name="Second Client",
        phone="770000003",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="770000003", password="password123")

    forbidden = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_same_phone_and_email_allowed_across_different_roles(client):
    register_user(
        client,
        full_name="Client One",
        phone="699123456",
        password="password123",
        role="client",
    )

    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Provider",
            "last_name": "One",
            "username": "provider.one",
            "email": "client.one@example.com",
            "address": "Douala, Akwa",
            "phone": "+237 699 123 456",
            "password": "password123",
            "role": "prestataire",
        },
    )
    assert response.status_code == 201, response.text


@pytest.mark.integration
def test_same_phone_or_email_blocked_within_same_role(client):
    register_user(
        client,
        full_name="Client Two",
        phone="677000111",
        password="password123",
        role="client",
    )

    duplicate_phone = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Client",
            "last_name": "Three",
            "username": "client.three",
            "email": "client.three@example.com",
            "address": "Yaounde, Emana",
            "phone": "+237 677 000 111",
            "password": "password123",
            "role": "client",
        },
    )
    assert duplicate_phone.status_code == 409

    duplicate_email = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Client",
            "last_name": "Four",
            "username": "client.four",
            "email": "client.two@example.com",
            "address": "Yaounde, Emana",
            "phone": "+237 677 000 222",
            "password": "password123",
            "role": "client",
        },
    )
    assert duplicate_email.status_code == 409


@pytest.mark.integration
def test_login_with_ambiguous_identifier_requires_role(client):
    register_user(
        client,
        full_name="Ambiguous Client",
        phone="699777888",
        password="password123",
        role="client",
    )
    register_user(
        client,
        full_name="Ambiguous Provider",
        phone="699777888",
        password="password123",
        role="prestataire",
    )

    ambiguous = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 699 777 888", "password": "password123"},
    )
    assert ambiguous.status_code == 409

    client_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 699 777 888", "password": "password123", "role": "client"},
    )
    assert client_login.status_code == 200

    prestataire_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 699 777 888", "password": "password123", "role": "prestataire"},
    )
    assert prestataire_login.status_code == 200


@pytest.mark.integration
def test_unregister_deletes_authenticated_user(client):
    register_user(
        client,
        full_name="Client Delete",
        phone="688123999",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="688123999", password="password123")

    response = client.post(
        "/api/v1/auth/unregister",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": "password123"},
    )
    assert response.status_code == 200

    cannot_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 688 123 999", "password": "password123"},
    )
    assert cannot_login.status_code == 401


@pytest.mark.integration
def test_admin_can_reset_user_password(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Reset Target",
        phone="699112233",
        password="oldpassword123",
        role="client",
    )

    admin_token = login_user(client, phone="699800701", password="password123")

    reset = client.patch(
        "/api/v1/auth/admin/users/2/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpassword123"},
    )
    assert reset.status_code == 200, reset.text

    old_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 699 112 233", "password": "oldpassword123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 699 112 233", "password": "newpassword123"},
    )
    assert new_login.status_code == 200


@pytest.mark.integration
def test_non_admin_cannot_reset_user_password(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Client Non Admin",
        phone="699223344",
        password="password123",
        role="client",
    )
    register_user(
        client,
        full_name="Reset Target 2",
        phone="699334455",
        password="password123",
        role="prestataire",
    )

    client_token = login_user(client, phone="699223344", password="password123")

    forbidden = client.patch(
        "/api/v1/auth/admin/users/3/reset-password",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"new_password": "newpassword123"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_admin_reset_password_emits_audit_log(client, db_session, caplog):
    create_admin(db_session)
    register_user(
        client,
        full_name="Audit Target",
        phone="699445566",
        password="oldpassword123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    caplog.set_level("INFO", logger="app.auth.audit")

    response = client.patch(
        "/api/v1/auth/admin/users/2/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpassword123"},
    )
    assert response.status_code == 200, response.text

    matching = [record for record in caplog.records if getattr(record, "event", None) == "admin_password_reset"]
    assert matching, "Expected admin_password_reset audit event"
    event = matching[-1]
    assert getattr(event, "actor_user_id", None) == 1
    assert getattr(event, "target_user_id", None) == 2

    db_events = db_session.query(AdminAuditEvent).all()
    assert len(db_events) == 1
    db_event = db_events[0]
    assert db_event.event_type == "admin_password_reset"
    assert db_event.actor_user_id == 1
    assert db_event.target_user_id == 2
    assert db_event.target_role == "client"
    payload = json.loads(db_event.metadata_json)
    assert payload["target_username"] == "audit.target.566"


@pytest.mark.integration
def test_admin_can_list_audit_events(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="List Target",
        phone="699556677",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    client.patch(
        "/api/v1/auth/admin/users/2/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpassword456"},
    )

    response = client.get(
        "/api/v1/auth/admin/audit-events",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 1
    assert data["page"] == 1
    assert len(data["items"]) == 1
    assert data["items"][0]["event_type"] == "admin_password_reset"


@pytest.mark.integration
def test_non_admin_cannot_list_audit_events(client, db_session):
    register_user(
        client,
        full_name="Non Admin Audit",
        phone="699667788",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="699667788", password="password123")

    response = client.get(
        "/api/v1/auth/admin/audit-events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


@pytest.mark.integration
def test_audit_events_filter_by_target_user_id(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Filter Target One",
        phone="699778899",
        password="password123",
        role="client",
    )
    register_user(
        client,
        full_name="Filter Target Two",
        phone="699889900",
        password="password123",
        role="prestataire",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    client.patch(
        "/api/v1/auth/admin/users/2/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpassword456"},
    )
    client.patch(
        "/api/v1/auth/admin/users/3/reset-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"new_password": "newpassword456"},
    )

    response = client.get(
        "/api/v1/auth/admin/audit-events?target_user_id=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["target_user_id"] == 2


@pytest.mark.integration
def test_audit_events_pagination(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Paginate Target",
        phone="699990011",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    for new_pw in ("newpass001", "newpass002", "newpass003"):
        client.patch(
            "/api/v1/auth/admin/users/2/reset-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"new_password": new_pw},
        )

    response = client.get(
        "/api/v1/auth/admin/audit-events?page=1&size=2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["size"] == 2


@pytest.mark.integration
def test_refresh_token_requires_authentication(client):
    response = client.post("/api/v1/auth/refresh")
    assert response.status_code == 401


@pytest.mark.integration
def test_refresh_token_returns_new_token(client):
    register_user(
        client,
        full_name="Refresh Token",
        phone="698111223",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="698111223", password="password123")

    response = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str)
    assert data["access_token"]


@pytest.mark.integration
def test_admin_can_change_user_role(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Role Target",
        phone="699321654",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    response = client.patch(
        "/api/v1/auth/admin/users/2/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "prestataire"},
    )
    assert response.status_code == 200, response.text

    target = db_session.get(User, 2)
    assert target is not None
    assert target.role == UserRole.PRESTATAIRE


@pytest.mark.integration
def test_admin_can_delete_user_without_business_links(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Delete Target",
        phone="699998877",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")

    response = client.delete(
        "/api/v1/auth/admin/users/2",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200, response.text
    assert db_session.get(User, 2) is None


@pytest.mark.integration
def test_admin_can_create_user_with_admin_role(client, db_session):
    create_admin(db_session)
    admin_token = login_user(client, phone="699800701", password="password123")

    response = client.post(
        "/api/v1/auth/admin/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "first_name": "Nouveau",
            "last_name": "Admin",
            "username": "nouveau.admin",
            "email": "nouveau.admin@example.com",
            "address": "Douala, Bonapriso",
            "phone": "+237 699 111 222",
            "password": "password123",
            "role": "admin",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["role"] == "admin"
    assert data["username"] == "nouveau.admin"

    audit = db_session.query(AdminAuditEvent).filter_by(event_type="admin_user_created").first()
    assert audit is not None
    assert audit.target_role == "admin"
    assert json.loads(audit.metadata_json)["created_role"] == "admin"


@pytest.mark.integration
def test_non_admin_cannot_create_user_via_admin_endpoint(client, db_session):
    register_user(
        client,
        full_name="Client Normal",
        phone="699444555",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="699444555", password="password123")

    response = client.post(
        "/api/v1/auth/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "first_name": "Hack",
            "last_name": "Attempt",
            "username": "hack.attempt",
            "email": "hack@example.com",
            "address": "Somewhere",
            "phone": "+237 699 000 001",
            "password": "password123",
            "role": "client",
        },
    )
    assert response.status_code == 403
