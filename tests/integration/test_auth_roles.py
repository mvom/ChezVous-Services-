import json
import pytest

from app.core.security import decode_token, hash_password
from app.db.models import AdminAuditEvent, Prestataire, User, UserRoleLink
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
def test_same_username_blocked_across_roles(client):
    first = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Unique",
            "last_name": "Name",
            "username": "qa.flow.shared",
            "email": "qa.flow.shared.client@example.com",
            "address": "Yaounde, Bastos",
            "phone": "+237 677 001 100",
            "password": "password123",
            "role": "client",
        },
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Unique",
            "last_name": "Name Two",
            "username": "qa.flow.shared",
            "email": "qa.flow.shared.provider@example.com",
            "address": "Douala, Akwa",
            "phone": "+237 677 001 101",
            "password": "password123",
            "role": "prestataire",
        },
    )
    assert duplicate.status_code == 409
    assert "nom d'utilisateur" in duplicate.json()["detail"].lower()


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
def test_login_rate_limiter_blocks_after_repeated_attempts(client):
    register_user(
        client,
        full_name="Rate Limit User",
        phone="699110220",
        password="password123",
        role="client",
    )

    payload = {"phone": "+237 699 110 220", "password": "wrongpassword"}

    for _ in range(5):
        resp = client.post("/api/v1/auth/login", json=payload)
        assert resp.status_code == 401

    blocked = client.post("/api/v1/auth/login", json=payload)
    assert blocked.status_code == 429


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
def test_login_returns_available_roles_and_active_role(client):
    register_user(
        client,
        full_name="Role Payload",
        phone="697111222",
        password="password123",
        role="client",
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 697 111 222", "password": "password123"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["active_role"] == "client"
    assert data["available_roles"] == ["client"]


@pytest.mark.integration
def test_add_role_self_service_success_returns_updated_roles(client, db_session):
    register_user(
        client,
        full_name="Add Role Self",
        phone="697909001",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="697909001", password="password123")

    response = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["active_role"] == "client"
    assert sorted(data["available_roles"]) == ["client", "prestataire"]

    payload = decode_token(data["access_token"])
    assert payload["role"] == "client"

    user = db_session.query(User).filter_by(phone="+237 697 909 001", role=UserRole.CLIENT).one()
    assert db_session.get(Prestataire, user.id) is not None
    assert (
        db_session.query(UserRoleLink)
        .filter_by(user_id=user.id, role=UserRole.PRESTATAIRE)
        .one_or_none()
        is not None
    )


@pytest.mark.integration
def test_add_role_self_service_rejects_duplicate_role(client):
    register_user(
        client,
        full_name="Add Role Duplicate",
        phone="697909002",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="697909002", password="password123")

    first = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert duplicate.status_code == 409
    assert "deja le role prestataire" in duplicate.json()["detail"]


@pytest.mark.integration
def test_add_role_self_service_rejects_admin_role(client):
    register_user(
        client,
        full_name="Add Role Admin Forbidden",
        phone="697909003",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="697909003", password="password123")

    forbidden = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "admin"},
    )
    assert forbidden.status_code == 403
    assert "interdit" in forbidden.json()["detail"]


@pytest.mark.integration
def test_switch_role_requires_role_membership(client):
    register_user(
        client,
        full_name="Switch Guard",
        phone="697333444",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="697333444", password="password123")

    forbidden = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_switch_role_requires_authentication(client):
    response = client.post(
        "/api/v1/auth/switch-role",
        json={"role": "client"},
    )
    assert response.status_code == 401


@pytest.mark.integration
def test_switch_role_rejects_forbidden_admin_role(client):
    register_user(
        client,
        full_name="Switch Admin Forbidden",
        phone="697909004",
        password="password123",
        role="client",
    )
    token = login_user(client, phone="697909004", password="password123")

    forbidden = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "admin"},
    )
    assert forbidden.status_code == 403
    assert "pas disponible" in forbidden.json()["detail"]


@pytest.mark.integration
def test_switch_role_returns_token_with_requested_active_role(client, db_session):
    register_user(
        client,
        full_name="Switch Ready",
        phone="697555666",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 555 666", role=UserRole.CLIENT).one()
    db_session.add(Prestataire(user_id=user.id, rating=0.0, verified=False))
    db_session.add(UserRoleLink(user_id=user.id, role=UserRole.PRESTATAIRE))
    db_session.commit()

    token = login_user(client, phone="697555666", password="password123")
    response = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["active_role"] == "prestataire"
    assert sorted(data["available_roles"]) == ["client", "prestataire"]

    switched_payload = decode_token(data["access_token"])
    assert switched_payload["role"] == "prestataire"

    roles_response = client.get(
        "/api/v1/auth/me/roles",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert roles_response.status_code == 200, roles_response.text
    roles = roles_response.json()
    assert roles["active_role"] == "prestataire"
    assert sorted(roles["available_roles"]) == ["client", "prestataire"]


@pytest.mark.integration
def test_switch_role_changes_authorization_for_provider_endpoints(client, db_session):
    register_user(
        client,
        full_name="Switch Access",
        phone="697777888",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 777 888", role=UserRole.CLIENT).one()
    db_session.add(Prestataire(user_id=user.id, rating=0.0, verified=False))
    db_session.add(UserRoleLink(user_id=user.id, role=UserRole.PRESTATAIRE))
    db_session.commit()

    client_token = login_user(client, phone="697777888", password="password123")

    forbidden = client.post(
        "/api/v1/services",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "prestataire_id": user.id,
            "name": "Service test",
            "description": "Description",
            "availability_slots": "Lun-Ven 08h-17h",
            "price": 10000,
        },
    )
    assert forbidden.status_code == 403

    switched = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"role": "prestataire"},
    )
    assert switched.status_code == 200, switched.text
    provider_token = switched.json()["access_token"]

    allowed = client.post(
        "/api/v1/services",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "prestataire_id": user.id,
            "name": "Service test switch",
            "description": "Description",
            "availability_slots": "Lun-Ven 08h-17h",
            "price": 12000,
        },
    )
    assert allowed.status_code == 201, allowed.text


@pytest.mark.integration
def test_login_with_secondary_role_for_dual_role_user(client, db_session):
    register_user(
        client,
        full_name="Dual Login",
        phone="697121212",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 121 212", role=UserRole.CLIENT).one()
    db_session.add(Prestataire(user_id=user.id, rating=0.0, verified=False))
    db_session.add(UserRoleLink(user_id=user.id, role=UserRole.PRESTATAIRE))
    db_session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"phone": "+237 697 121 212", "password": "password123", "role": "prestataire"},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert data["active_role"] == "prestataire"
    assert sorted(data["available_roles"]) == ["client", "prestataire"]

    payload = decode_token(data["access_token"])
    assert payload["role"] == "prestataire"


@pytest.mark.integration
def test_refresh_preserves_active_role_after_switch(client, db_session):
    register_user(
        client,
        full_name="Refresh Switch",
        phone="697232323",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 232 323", role=UserRole.CLIENT).one()
    db_session.add(Prestataire(user_id=user.id, rating=0.0, verified=False))
    db_session.add(UserRoleLink(user_id=user.id, role=UserRole.PRESTATAIRE))
    db_session.commit()

    client_token = login_user(client, phone="697232323", password="password123")
    switched = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"role": "prestataire"},
    )
    assert switched.status_code == 200, switched.text
    provider_token = switched.json()["access_token"]

    refreshed = client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {provider_token}"},
    )
    assert refreshed.status_code == 200, refreshed.text
    data = refreshed.json()
    assert data["active_role"] == "prestataire"
    assert sorted(data["available_roles"]) == ["client", "prestataire"]

    refreshed_payload = decode_token(data["access_token"])
    assert refreshed_payload["role"] == "prestataire"


@pytest.mark.integration
def test_require_roles_fallbacks_to_legacy_user_role_without_user_role_links(client, db_session):
    register_user(
        client,
        full_name="Legacy Fallback",
        phone="697343434",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 343 434", role=UserRole.CLIENT).one()
    db_session.query(UserRoleLink).filter(UserRoleLink.user_id == user.id).delete()
    db_session.commit()

    token = login_user(client, phone="697343434", password="password123")
    create_demande = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "client_id": user.id,
            "description": "Besoin menage complet",
            "location": "Akwa",
            "ville": "Douala",
            "arrondissement": "Douala 1",
            "quartier": "Akwa",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )
    assert create_demande.status_code == 201, create_demande.text


@pytest.mark.integration
def test_switch_to_provider_blocks_client_endpoints(client, db_session):
    register_user(
        client,
        full_name="Switch Client Block",
        phone="697454545",
        password="password123",
        role="client",
    )
    user = db_session.query(User).filter_by(phone="+237 697 454 545", role=UserRole.CLIENT).one()
    db_session.add(Prestataire(user_id=user.id, rating=0.0, verified=False))
    db_session.add(UserRoleLink(user_id=user.id, role=UserRole.PRESTATAIRE))
    db_session.commit()

    client_token = login_user(client, phone="697454545", password="password123")

    switched = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"role": "prestataire"},
    )
    assert switched.status_code == 200, switched.text
    provider_token = switched.json()["access_token"]

    forbidden = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "client_id": user.id,
            "description": "Demande depuis mauvais role",
            "location": "Bonapriso",
            "ville": "Douala",
            "arrondissement": "Douala 2",
            "quartier": "Bonapriso",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )
    assert forbidden.status_code == 403


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
def test_admin_add_role_requires_admin_rights(client, db_session):
    register_user(
        client,
        full_name="Admin Add Target",
        phone="697909005",
        password="password123",
        role="client",
    )
    register_user(
        client,
        full_name="Admin Add Actor",
        phone="697909006",
        password="password123",
        role="client",
    )
    actor_token = login_user(client, phone="697909006", password="password123")
    target = db_session.query(User).filter_by(phone="+237 697 909 005", role=UserRole.CLIENT).one()

    forbidden = client.post(
        f"/api/v1/auth/admin/users/{target.id}/add-role",
        headers={"Authorization": f"Bearer {actor_token}"},
        json={"role": "prestataire"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_admin_add_role_success_and_audit_event(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Admin Add Success",
        phone="697909007",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")
    target = db_session.query(User).filter_by(phone="+237 697 909 007", role=UserRole.CLIENT).one()

    response = client.post(
        f"/api/v1/auth/admin/users/{target.id}/add-role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "prestataire"},
    )
    assert response.status_code == 201, response.text
    assert "ajoute" in response.json()["detail"]

    assert db_session.get(Prestataire, target.id) is not None
    assert (
        db_session.query(UserRoleLink)
        .filter_by(user_id=target.id, role=UserRole.PRESTATAIRE)
        .one_or_none()
        is not None
    )

    audit = db_session.query(AdminAuditEvent).filter_by(event_type="admin_role_added", target_user_id=target.id).one_or_none()
    assert audit is not None
    assert audit.actor_user_id == 1
    assert audit.target_role == "prestataire"


@pytest.mark.integration
def test_admin_add_role_rejects_duplicate_role(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Admin Add Duplicate",
        phone="697909008",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")
    target = db_session.query(User).filter_by(phone="+237 697 909 008", role=UserRole.CLIENT).one()

    first = client.post(
        f"/api/v1/auth/admin/users/{target.id}/add-role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "prestataire"},
    )
    assert first.status_code == 201, first.text

    duplicate = client.post(
        f"/api/v1/auth/admin/users/{target.id}/add-role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "prestataire"},
    )
    assert duplicate.status_code == 409
    assert "deja le role prestataire" in duplicate.json()["detail"]


@pytest.mark.integration
def test_admin_add_role_rejects_forbidden_admin_role(client, db_session):
    create_admin(db_session)
    register_user(
        client,
        full_name="Admin Add Forbidden",
        phone="697909009",
        password="password123",
        role="client",
    )
    admin_token = login_user(client, phone="699800701", password="password123")
    target = db_session.query(User).filter_by(phone="+237 697 909 009", role=UserRole.CLIENT).one()

    forbidden = client.post(
        f"/api/v1/auth/admin/users/{target.id}/add-role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "admin"},
    )
    assert forbidden.status_code == 403
    assert "interdit" in forbidden.json()["detail"]


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
