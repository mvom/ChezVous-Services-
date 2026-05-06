import pytest

from app.db.models import Demande, Prestataire
from tests.conftest import login_user, register_user


@pytest.mark.integration
def test_matching_owner_client_can_access_own_demande(client):
    owner = register_user(
        client,
        full_name="Client Owner",
        phone="699111001",
        password="password123",
        role="client",
    )
    provider = register_user(
        client,
        full_name="Provider Match",
        phone="699111002",
        password="password123",
        role="prestataire",
    )
    owner_token = login_user(client, phone="699111001", password="password123")

    created = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "client_id": owner["id"],
            "description": "Nettoyage salon et cuisine",
            "location": "Douala, Bonamoussadi",
            "ville": "Douala",
            "arrondissement": "Douala 5",
            "quartier": "Bonamoussadi",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )
    assert created.status_code == 201, created.text
    demande_id = created.json()["id"]

    response = client.get(
        f"/api/v1/demandes/{demande_id}/matching",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["demande_id"] == demande_id
    assert body["available_count"] == 1
    assert len(body["candidates"]) == 1
    assert body["candidates"][0]["user_id"] == provider["id"]
    assert 0 <= body["candidates"][0]["score_total"] <= 100


@pytest.mark.integration
def test_matching_other_client_is_forbidden(client):
    owner = register_user(
        client,
        full_name="Client Alpha",
        phone="699222001",
        password="password123",
        role="client",
    )
    register_user(
        client,
        full_name="Provider Any",
        phone="699222002",
        password="password123",
        role="prestataire",
    )
    register_user(
        client,
        full_name="Client Beta",
        phone="699222003",
        password="password123",
        role="client",
    )

    owner_token = login_user(client, phone="699222001", password="password123")
    outsider_token = login_user(client, phone="699222003", password="password123")

    created = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "client_id": owner["id"],
            "description": "Depannage plomberie",
            "location": "Yaounde, Bastos",
            "ville": "Yaounde",
            "arrondissement": "Yaounde 1",
            "quartier": "Bastos",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )
    assert created.status_code == 201, created.text
    demande_id = created.json()["id"]

    forbidden = client.get(
        f"/api/v1/demandes/{demande_id}/matching",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert forbidden.status_code == 403


@pytest.mark.integration
def test_matching_returns_empty_when_no_provider_exists(client):
    owner = register_user(
        client,
        full_name="Client Solo",
        phone="699333001",
        password="password123",
        role="client",
    )
    owner_token = login_user(client, phone="699333001", password="password123")

    created = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "client_id": owner["id"],
            "description": "Mise en ordre appartement",
            "location": "Yaounde, Emana",
            "ville": "Yaounde",
            "arrondissement": "Yaounde 2",
            "quartier": "Emana",
            "client_availability_mode": "flexible",
            "priority": "basse",
        },
    )
    assert created.status_code == 201, created.text
    demande_id = created.json()["id"]

    response = client.get(
        f"/api/v1/demandes/{demande_id}/matching",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert response.status_code == 200
    assert response.json()["available_count"] == 0
    assert response.json()["candidates"] == []


@pytest.mark.integration
def test_matching_gps_provider_scores_higher_than_text_fallback(client, db_session):
    owner = register_user(
        client,
        full_name="Client Geo",
        phone="699444001",
        password="password123",
        role="client",
    )
    near_provider = register_user(
        client,
        full_name="Provider Near",
        phone="699444002",
        password="password123",
        role="prestataire",
    )
    far_provider = register_user(
        client,
        full_name="Provider Fallback",
        phone="699444003",
        password="password123",
        role="prestataire",
    )

    owner_token = login_user(client, phone="699444001", password="password123")

    created = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {owner_token}"},
        json={
            "client_id": owner["id"],
            "description": "Nettoyage terrasse",
            "location": "Douala, Akwa",
            "ville": "Douala",
            "arrondissement": "Douala 1",
            "quartier": "Akwa",
            "client_availability_mode": "flexible",
            "priority": "normale",
        },
    )
    assert created.status_code == 201, created.text
    demande_id = created.json()["id"]

    demande = db_session.get(Demande, demande_id)
    assert demande is not None
    demande.latitude = 4.051056
    demande.longitude = 9.767869

    near = db_session.get(Prestataire, near_provider["id"])
    fallback = db_session.get(Prestataire, far_provider["id"])
    assert near is not None and fallback is not None

    near.latitude = 4.052000
    near.longitude = 9.768100
    fallback.latitude = None
    fallback.longitude = None

    db_session.commit()

    response = client.get(
        f"/api/v1/demandes/{demande_id}/matching",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    by_id = {candidate["user_id"]: candidate for candidate in body["candidates"]}
    near_candidate = by_id[near_provider["id"]]
    fallback_candidate = by_id[far_provider["id"]]

    assert near_candidate["score_zone"] > fallback_candidate["score_zone"]
    assert near_candidate["score_total"] > fallback_candidate["score_total"]
