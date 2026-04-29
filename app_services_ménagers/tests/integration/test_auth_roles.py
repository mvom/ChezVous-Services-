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

    register_user(
        client,
        full_name="Admin User",
        phone="770000002",
        password="password123",
        role="admin",
    )
    admin_token = login_user(client, phone="770000002", password="password123")

    ok = client.get(
        "/api/v1/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert ok.status_code == 200
    assert len(ok.json()) == 2
