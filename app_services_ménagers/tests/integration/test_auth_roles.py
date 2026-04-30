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
