"""Tests d'intégration supplémentaires pour l'API auth (profil, badges, loyalty, switch-role)."""
import pytest
from tests.conftest import login_user, register_user


@pytest.mark.integration
def test_get_me_returns_authenticated_user(client):
    u = register_user(client, full_name="Me Client", phone="699600001", password="pw123456", role="client")
    token = login_user(client, phone="699600001", password="pw123456")
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == u["id"]


@pytest.mark.integration
def test_get_me_fails_without_token(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.integration
def test_get_me_roles_after_registration(client):
    register_user(client, full_name="Roles Client", phone="699600002", password="pw123456", role="client")
    token = login_user(client, phone="699600002", password="pw123456")
    resp = client.get("/api/v1/auth/me/roles", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["active_role"] == "client"
    assert "client" in data["available_roles"]


@pytest.mark.integration
def test_switch_role_requires_second_role(client):
    register_user(client, full_name="Switch Only", phone="699600003", password="pw123456", role="client")
    token = login_user(client, phone="699600003", password="pw123456")
    resp = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert resp.status_code == 403


@pytest.mark.integration
def test_switch_role_after_add_role(client):
    register_user(client, full_name="Switch Both", phone="699600004", password="pw123456", role="client")
    token = login_user(client, phone="699600004", password="pw123456")
    # Add prestataire role
    resp = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "prestataire"},
    )
    assert resp.status_code == 201
    new_token = resp.json()["access_token"]
    # Switch to prestataire
    resp2 = client.post(
        "/api/v1/auth/switch-role",
        headers={"Authorization": f"Bearer {new_token}"},
        json={"role": "prestataire"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["active_role"] == "prestataire"


@pytest.mark.integration
def test_add_role_already_held_is_rejected(client):
    register_user(client, full_name="Dup Role", phone="699600005", password="pw123456", role="client")
    token = login_user(client, phone="699600005", password="pw123456")
    resp = client.post(
        "/api/v1/auth/add-role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "client"},
    )
    assert resp.status_code == 409


@pytest.mark.integration
def test_refresh_token_returns_new_token(client):
    register_user(client, full_name="Refresh User", phone="699600006", password="pw123456", role="client")
    token = login_user(client, phone="699600006", password="pw123456")
    resp = client.post("/api/v1/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.integration
def test_get_me_loyalty_requires_client_role(client):
    register_user(client, full_name="Loyalty Client", phone="699600007", password="pw123456", role="client")
    token = login_user(client, phone="699600007", password="pw123456")
    resp = client.get("/api/v1/auth/me/loyalty", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "loyalty_points" in data


@pytest.mark.integration
def test_get_me_loyalty_forbidden_for_prestataire(client):
    register_user(client, full_name="Presta Loyal", phone="699600008", password="pw123456", role="prestataire")
    token = login_user(client, phone="699600008", password="pw123456")
    resp = client.get("/api/v1/auth/me/loyalty", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.integration
def test_get_me_badges_returns_list(client):
    register_user(client, full_name="Badge Client", phone="699600009", password="pw123456", role="client")
    token = login_user(client, phone="699600009", password="pw123456")
    resp = client.get("/api/v1/auth/me/badges", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.integration
def test_update_avatar_too_large_returns_413(client):
    register_user(client, full_name="Avatar Client", phone="699600010", password="pw123456", role="client")
    token = login_user(client, phone="699600010", password="pw123456")
    resp = client.patch(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_url": "data:image/png;base64," + ("A" * 3_000_001)},
    )
    assert resp.status_code == 413


@pytest.mark.integration
def test_update_avatar_valid_url(client):
    register_user(client, full_name="Avatar Valid", phone="699600011", password="pw123456", role="client")
    token = login_user(client, phone="699600011", password="pw123456")
    resp = client.patch(
        "/api/v1/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        json={"avatar_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="},
    )
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is not None


@pytest.mark.integration
def test_login_invalid_password_returns_401(client):
    register_user(client, full_name="Login Fail", phone="699600012", password="pw123456", role="client")
    resp = client.post("/api/v1/auth/login", json={"phone": "+237 699 600 012", "password": "wrongpassword"})
    assert resp.status_code == 401


@pytest.mark.integration
def test_login_unknown_phone_returns_401(client):
    resp = client.post("/api/v1/auth/login", json={"phone": "+237 699 999 999", "password": "pw123456"})
    assert resp.status_code == 401


@pytest.mark.integration
def test_health_endpoint_returns_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.integration
def test_ready_endpoint_returns_ok_with_db(client):
    resp = client.get("/ready")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["database"] == "up"
