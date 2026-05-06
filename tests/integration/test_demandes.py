"""Tests d'intégration pour les routes demandes."""
import pytest
from tests.conftest import login_user, register_user


def _setup_client(client):
    u = register_user(client, full_name="Demande Client", phone="699300001", password="pw123456", role="client")
    token = login_user(client, phone="699300001", password="pw123456")
    return u, token


def _setup_prestataire(client):
    u = register_user(client, full_name="Demande Presta", phone="699300002", password="pw123456", role="prestataire")
    token = login_user(client, phone="699300002", password="pw123456")
    return u, token


def _create_demande(client, token, client_id, extra=None):
    body = {
        "client_id": client_id,
        "description": "Nettoyage complet",
        "location": "Douala, Akwa",
        "ville": "Douala",
        "arrondissement": "Douala 1",
        "quartier": "Akwa",
        **(extra or {}),
    }
    return client.post("/api/v1/demandes", headers={"Authorization": f"Bearer {token}"}, json=body)


@pytest.mark.integration
def test_client_can_create_demande(client):
    u, token = _setup_client(client)
    resp = _create_demande(client, token, u["id"])
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "ouverte"
    assert data["client_id"] == u["id"]


@pytest.mark.integration
def test_client_cannot_create_demande_for_other_client(client):
    u1, token1 = _setup_client(client)
    u2 = register_user(client, full_name="Other Client", phone="699300003", password="pw123456", role="client")
    resp = _create_demande(client, token1, u2["id"])
    assert resp.status_code == 403


@pytest.mark.integration
def test_unauthenticated_cannot_create_demande(client):
    resp = client.post("/api/v1/demandes", json={
        "client_id": 1, "description": "x", "location": "y",
        "ville": "y", "arrondissement": "y", "quartier": "y",
    })
    assert resp.status_code == 401


@pytest.mark.integration
def test_prestataire_cannot_create_demande(client):
    _, p_token = _setup_prestataire(client)
    resp = _create_demande(client, p_token, 1)
    assert resp.status_code == 403


@pytest.mark.integration
def test_list_demandes_requires_auth(client):
    resp = client.get("/api/v1/demandes")
    assert resp.status_code == 401


@pytest.mark.integration
def test_list_demandes_returns_created_demandes(client):
    u, token = _setup_client(client)
    _create_demande(client, token, u["id"])
    _create_demande(client, token, u["id"])
    resp = client.get("/api/v1/demandes", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.integration
def test_prestataire_can_update_demande_status(client):
    u, c_token = _setup_client(client)
    _, p_token = _setup_prestataire(client)
    demande = _create_demande(client, c_token, u["id"]).json()
    resp = client.patch(
        f"/api/v1/demandes/{demande['id']}/status",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"status": "attribuee"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "attribuee"


@pytest.mark.integration
def test_client_cannot_update_demande_status(client):
    u, c_token = _setup_client(client)
    demande = _create_demande(client, c_token, u["id"]).json()
    resp = client.patch(
        f"/api/v1/demandes/{demande['id']}/status",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"status": "attribuee"},
    )
    assert resp.status_code == 403


@pytest.mark.integration
def test_client_can_cancel_own_demande(client):
    u, c_token = _setup_client(client)
    demande = _create_demande(client, c_token, u["id"]).json()
    resp = client.post(
        f"/api/v1/demandes/{demande['id']}/cancel",
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "annulee"


@pytest.mark.integration
def test_client_can_update_demande_description(client):
    u, c_token = _setup_client(client)
    demande = _create_demande(client, c_token, u["id"]).json()
    resp = client.patch(
        f"/api/v1/demandes/{demande['id']}",
        headers={"Authorization": f"Bearer {c_token}"},
        json={
            "description": "Nouvelle description",
            "ville": "Douala",
            "arrondissement": "Douala 1",
            "quartier": "Akwa",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["description"] == "Nouvelle description"


@pytest.mark.integration
def test_demande_with_priority_haute(client):
    u, token = _setup_client(client)
    resp = _create_demande(client, token, u["id"], {"priority": "haute"})
    assert resp.status_code == 201
    assert resp.json()["priority"] == "haute"


@pytest.mark.integration
def test_demande_with_availability_mode_fixe(client):
    u, token = _setup_client(client)
    resp = _create_demande(client, token, u["id"], {
        "client_availability_mode": "fixe",
        "client_availability_note": "Disponible le matin uniquement",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["client_availability_mode"] == "fixe"


@pytest.mark.integration
def test_demande_matching_endpoint_accessible_by_client(client):
    u, c_token = _setup_client(client)
    demande = _create_demande(client, c_token, u["id"]).json()
    resp = client.get(
        f"/api/v1/demandes/{demande['id']}/matching",
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "candidates" in data


@pytest.mark.integration
def test_demande_matching_returns_404_for_unknown_id(client):
    u, c_token = _setup_client(client)
    resp = client.get(
        "/api/v1/demandes/99999/matching",
        headers={"Authorization": f"Bearer {c_token}"},
    )
    assert resp.status_code == 404


@pytest.mark.integration
def test_demande_matching_forbidden_for_other_client(client):
    u1, t1 = _setup_client(client)
    u2 = register_user(client, full_name="Other Client", phone="699300004", password="pw123456", role="client")
    t2 = login_user(client, phone="699300004", password="pw123456")
    demande = _create_demande(client, t1, u1["id"]).json()
    resp = client.get(
        f"/api/v1/demandes/{demande['id']}/matching",
        headers={"Authorization": f"Bearer {t2}"},
    )
    assert resp.status_code == 403
