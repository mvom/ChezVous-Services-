import pytest

from tests.conftest import login_user, register_user


@pytest.mark.e2e
def test_client_to_prestataire_full_flow(client):
    created_client = register_user(
        client,
        full_name="Alice Client",
        phone="780000001",
        password="password123",
        role="client",
    )
    created_prestataire = register_user(
        client,
        full_name="Bob Prestataire",
        phone="780000002",
        password="password123",
        role="prestataire",
    )

    client_token = login_user(client, phone="780000001", password="password123")
    prestataire_token = login_user(client, phone="780000002", password="password123")

    demande_response = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "client_id": created_client["id"],
            "description": "Nettoyage appartement 2 pieces",
            "location": "Dakar Plateau",
        },
    )
    assert demande_response.status_code == 201, demande_response.text
    demande = demande_response.json()

    service_response = client.post(
        "/api/v1/services",
        headers={"Authorization": f"Bearer {prestataire_token}"},
        json={
            "prestataire_id": created_prestataire["id"],
            "name": "Menage hebdomadaire",
            "description": "Service standard",
            "price": 15000,
        },
    )
    assert service_response.status_code == 201, service_response.text
    service = service_response.json()

    mission_response = client.post(
        "/api/v1/missions",
        headers={"Authorization": f"Bearer {prestataire_token}"},
        json={
            "demande_id": demande["id"],
            "client_id": created_client["id"],
            "prestataire_id": created_prestataire["id"],
            "service_id": service["id"],
        },
    )
    assert mission_response.status_code == 201, mission_response.text
    mission = mission_response.json()

    paiement_response = client.post(
        "/api/v1/paiements",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "mission_id": mission["id"],
            "amount": 15000,
            "method": "mobile_money",
        },
    )
    assert paiement_response.status_code == 201, paiement_response.text

    review_response = client.post(
        "/api/v1/reviews",
        headers={"Authorization": f"Bearer {client_token}"},
        json={
            "mission_id": mission["id"],
            "client_id": created_client["id"],
            "prestataire_id": created_prestataire["id"],
            "rating": 5,
            "comment": "Excellent service",
        },
    )
    assert review_response.status_code == 201, review_response.text

    list_missions = client.get(
        "/api/v1/missions",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert list_missions.status_code == 200
    assert len(list_missions.json()) == 1
