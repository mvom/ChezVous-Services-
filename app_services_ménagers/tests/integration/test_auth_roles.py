import pytest

from tests.conftest import login_user, register_user


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
            "full_name": "Admin Blocked",
            "phone": "770000099",
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
