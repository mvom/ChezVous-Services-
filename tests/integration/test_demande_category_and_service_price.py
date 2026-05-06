import pytest

from tests.conftest import login_user, register_user


@pytest.mark.integration
def test_client_can_create_demande_with_explicit_category(client):
    created_client = register_user(
        client,
        full_name="Category Client",
        phone="699121314",
        password="password123",
        role="client",
    )
    client_token = login_user(client, phone="699121314", password="password123")

    response = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "client_id": created_client["id"],
            "category": "plomberie",
            "description": "Fuite sous evier a reparer",
            "location": "Douala, Akwa",
            "ville": "Douala",
            "arrondissement": "Douala 1",
            "quartier": "Akwa",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["category"] == "plomberie"


@pytest.mark.integration
def test_demande_category_defaults_to_menage_when_not_provided(client):
    created_client = register_user(
        client,
        full_name="Default Category",
        phone="699131415",
        password="password123",
        role="client",
    )
    client_token = login_user(client, phone="699131415", password="password123")

    response = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "client_id": created_client["id"],
            "description": "Nettoyage studio hebdomadaire",
            "location": "Yaounde, Bastos",
            "ville": "Yaounde",
            "arrondissement": "Yaounde 1",
            "quartier": "Bastos",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["category"] == "menage"


@pytest.mark.integration
def test_prestataire_can_create_service_without_price(client):
    created_provider = register_user(
        client,
        full_name="No Price Provider",
        phone="699141516",
        password="password123",
        role="prestataire",
    )
    provider_token = login_user(client, phone="699141516", password="password123")

    response = client.post(
        "/api/v1/services",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "prestataire_id": created_provider["id"],
            "name": "Intervention sur devis",
            "description": "Diagnostic avant tarification",
            "availability_slots": "Lun-Sam 08h-18h",
            "price": None,
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["price"] is None
