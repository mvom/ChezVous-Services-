"""Tests d'intégration pour les routes prestataires (profil, zone, notifications)."""
import pytest
from tests.conftest import login_user, register_user


def _reg_presta(client, name, phone):
    u = register_user(client, full_name=name, phone=phone, password="pw123456", role="prestataire")
    token = login_user(client, phone=phone, password="pw123456")
    return u, token


@pytest.mark.integration
def test_list_prestataires_requires_auth(client):
    resp = client.get("/api/v1/prestataires")
    assert resp.status_code == 401


@pytest.mark.integration
def test_list_prestataires_returns_registered(client):
    p, p_token = _reg_presta(client, "Presta List", "699500001")
    resp = client.get("/api/v1/prestataires", headers={"Authorization": f"Bearer {p_token}"})
    assert resp.status_code == 200
    ids = [item["user_id"] for item in resp.json()]
    assert p["id"] in ids


@pytest.mark.integration
def test_list_prestataires_verified_only_filter(client):
    _, p_token = _reg_presta(client, "Presta Unverified", "699500002")
    resp = client.get("/api/v1/prestataires?verified_only=true", headers={"Authorization": f"Bearer {p_token}"})
    assert resp.status_code == 200
    # no verified prestataire yet
    assert resp.json() == []


@pytest.mark.integration
def test_prestataire_can_update_visibility_mode(client):
    _, p_token = _reg_presta(client, "Presta Vis", "699500003")
    resp = client.patch(
        "/api/v1/prestataires/me/visibility",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"visibility_mode": "discret"},
    )
    assert resp.status_code == 200
    assert resp.json()["visibility_mode"] == "discret"


@pytest.mark.integration
def test_client_cannot_update_visibility(client):
    u = register_user(client, full_name="Client Vis", phone="699500004", password="pw123456", role="client")
    c_token = login_user(client, phone="699500004", password="pw123456")
    resp = client.patch(
        "/api/v1/prestataires/me/visibility",
        headers={"Authorization": f"Bearer {c_token}"},
        json={"visibility_mode": "discret"},
    )
    assert resp.status_code == 403


@pytest.mark.integration
def test_prestataire_can_update_zone_preference(client):
    _, p_token = _reg_presta(client, "Presta Zone", "699500005")
    resp = client.patch(
        "/api/v1/prestataires/me/zone",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"zone_preference_ville": "Yaounde", "zone_preference_arrondissement": "Yaounde 1"},
    )
    assert resp.status_code == 200
    assert resp.json()["zone_preference_ville"] == "Yaounde"


@pytest.mark.integration
def test_prestataire_notifications_empty_by_default(client):
    _, p_token = _reg_presta(client, "Presta Notif", "699500006")
    resp = client.get(
        "/api/v1/prestataires/me/notifications",
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.integration
def test_mark_notifications_read_returns_no_content(client):
    _, p_token = _reg_presta(client, "Presta NotifRead", "699500007")
    resp = client.post(
        "/api/v1/prestataires/me/notifications/read-all",
        headers={"Authorization": f"Bearer {p_token}"},
    )
    assert resp.status_code == 204
