"""Tests d'intégration pour services, missions, paiements, reviews."""
import pytest
from tests.conftest import login_user, register_user


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _reg_login(client, name, phone, role):
    u = register_user(client, full_name=name, phone=phone, password="pw123456", role=role)
    token = login_user(client, phone=phone, password="pw123456")
    return u, token


def _demande(client, c_token, client_id):
    return client.post("/api/v1/demandes", headers={"Authorization": f"Bearer {c_token}"}, json={
        "client_id": client_id,
        "description": "Service test",
        "location": "Yaounde, Centre",
        "ville": "Yaounde",
        "arrondissement": "Yaounde 1",
        "quartier": "Centre",
    }).json()


def _service(client, p_token, prestataire_id, price=None):
    body = {
        "prestataire_id": prestataire_id,
        "name": "Service test",
        "description": "Desc",
        "availability_slots": "Lun-Ven 8h-17h",
    }
    if price is not None:
        body["price"] = price
    return client.post("/api/v1/services", headers={"Authorization": f"Bearer {p_token}"}, json=body).json()


def _mission(client, p_token, demande_id, client_id, prestataire_id, service_id=None):
    body = {"demande_id": demande_id, "client_id": client_id, "prestataire_id": prestataire_id}
    if service_id:
        body["service_id"] = service_id
    return client.post("/api/v1/missions", headers={"Authorization": f"Bearer {p_token}"}, json=body)


# ─── Services ─────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_prestataire_can_create_service(client):
    p, p_token = _reg_login(client, "Presta S1", "699400001", "prestataire")
    resp = client.post("/api/v1/services", headers={"Authorization": f"Bearer {p_token}"}, json={
        "prestataire_id": p["id"],
        "name": "Ménage premium",
        "description": "Nettoyage complet",
        "availability_slots": "7j/7",
        "price": 25000,
    })
    assert resp.status_code == 201
    assert resp.json()["name"] == "Ménage premium"
    assert resp.json()["price"] == 25000.0


@pytest.mark.integration
def test_prestataire_cannot_create_service_for_other(client):
    p1, t1 = _reg_login(client, "Presta S2", "699400002", "prestataire")
    p2, _ = _reg_login(client, "Presta S3", "699400003", "prestataire")
    resp = client.post("/api/v1/services", headers={"Authorization": f"Bearer {t1}"}, json={
        "prestataire_id": p2["id"],
        "name": "Service Test", "description": "Desc", "availability_slots": "Lun-Ven",
    })
    assert resp.status_code == 403

@pytest.mark.integration
def test_client_cannot_create_service(client):
    c, c_token = _reg_login(client, "Client Svc", "699400004", "client")
    resp = client.post("/api/v1/services", headers={"Authorization": f"Bearer {c_token}"}, json={
        "prestataire_id": c["id"], "name": "Service Test", "description": "Desc", "availability_slots": "Lun-Ven",
    })
    assert resp.status_code == 403


@pytest.mark.integration
def test_list_services_returns_all(client):
    p, p_token = _reg_login(client, "Presta List", "699400005", "prestataire")
    _service(client, p_token, p["id"])
    _service(client, p_token, p["id"])
    resp = client.get("/api/v1/services", headers={"Authorization": f"Bearer {p_token}"})
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.integration
def test_list_services_filtered_by_prestataire(client):
    p, p_token = _reg_login(client, "Presta Filter", "699400006", "prestataire")
    _service(client, p_token, p["id"])
    resp = client.get(f"/api/v1/services?prestataire_id={p['id']}", headers={"Authorization": f"Bearer {p_token}"})
    assert resp.status_code == 200
    for svc in resp.json():
        assert svc["prestataire_id"] == p["id"]


# ─── Missions ─────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_prestataire_can_create_mission(client):
    c, c_token = _reg_login(client, "Client M1", "699410001", "client")
    p, p_token = _reg_login(client, "Presta M1", "699410002", "prestataire")
    dem = _demande(client, c_token, c["id"])
    resp = _mission(client, p_token, dem["id"], c["id"], p["id"])
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "en_attente"
    assert data["client_id"] == c["id"]


@pytest.mark.integration
def test_client_cannot_create_mission(client):
    c, c_token = _reg_login(client, "Client M2", "699410003", "client")
    p, _ = _reg_login(client, "Presta M2", "699410004", "prestataire")
    dem = _demande(client, c_token, c["id"])
    resp = _mission(client, c_token, dem["id"], c["id"], p["id"])
    assert resp.status_code == 403


@pytest.mark.integration
def test_prestataire_cannot_create_mission_for_other(client):
    c, c_token = _reg_login(client, "Client M3", "699410005", "client")
    p1, t1 = _reg_login(client, "Presta M3a", "699410006", "prestataire")
    p2, _ = _reg_login(client, "Presta M3b", "699410007", "prestataire")
    dem = _demande(client, c_token, c["id"])
    resp = _mission(client, t1, dem["id"], c["id"], p2["id"])
    assert resp.status_code == 403


@pytest.mark.integration
def test_list_missions_requires_auth(client):
    resp = client.get("/api/v1/missions")
    assert resp.status_code == 401


@pytest.mark.integration
def test_list_missions_returns_created(client):
    c, c_token = _reg_login(client, "Client M4", "699410008", "client")
    p, p_token = _reg_login(client, "Presta M4", "699410009", "prestataire")
    dem = _demande(client, c_token, c["id"])
    _mission(client, p_token, dem["id"], c["id"], p["id"])
    resp = client.get("/api/v1/missions", headers={"Authorization": f"Bearer {c_token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.integration
def test_update_mission_status_to_en_cours(client):
    c, c_token = _reg_login(client, "Client M5", "699410010", "client")
    p, p_token = _reg_login(client, "Presta M5", "699410011", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.patch(
        f"/api/v1/missions/{mission['id']}/status",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"status": "en_cours"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "en_cours"


@pytest.mark.integration
def test_update_mission_status_to_terminee(client, monkeypatch):
    from app.tasks import tasks as celery_tasks
    monkeypatch.setattr(celery_tasks.award_badges, "delay", lambda *a, **kw: None)
    monkeypatch.setattr(celery_tasks.loyalty_credit, "delay", lambda *a, **kw: None)
    c, c_token = _reg_login(client, "Client M6", "699410012", "client")
    p, p_token = _reg_login(client, "Presta M6", "699410013", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    client.patch(
        f"/api/v1/missions/{mission['id']}/status",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"status": "en_cours"},
    )
    resp = client.patch(
        f"/api/v1/missions/{mission['id']}/status",
        headers={"Authorization": f"Bearer {p_token}"},
        json={"status": "terminee"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "terminee"


# ─── Paiements ────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_client_can_create_paiement(client):
    c, c_token = _reg_login(client, "Client P1", "699420001", "client")
    p, p_token = _reg_login(client, "Presta P1", "699420002", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.post("/api/v1/paiements", headers={"Authorization": f"Bearer {c_token}"}, json={
        "mission_id": mission["id"],
        "amount": 15000,
        "method": "mobile_money",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 15000.0
    assert data["status"] == "en_attente"


@pytest.mark.integration
def test_prestataire_cannot_create_paiement(client):
    c, c_token = _reg_login(client, "Client P2", "699420003", "client")
    p, p_token = _reg_login(client, "Presta P2", "699420004", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.post("/api/v1/paiements", headers={"Authorization": f"Bearer {p_token}"}, json={
        "mission_id": mission["id"],
        "amount": 5000,
        "method": "especes",
    })
    assert resp.status_code == 403


@pytest.mark.integration
def test_list_paiements_returns_created(client):
    c, c_token = _reg_login(client, "Client P3", "699420005", "client")
    p, p_token = _reg_login(client, "Presta P3", "699420006", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    client.post("/api/v1/paiements", headers={"Authorization": f"Bearer {c_token}"}, json={
        "mission_id": mission["id"], "amount": 8000, "method": "carte",
    })
    resp = client.get("/api/v1/paiements", headers={"Authorization": f"Bearer {c_token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ─── Reviews ──────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_client_can_post_review_after_mission(client):
    c, c_token = _reg_login(client, "Client R1", "699430001", "client")
    p, p_token = _reg_login(client, "Presta R1", "699430002", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.post("/api/v1/reviews", headers={"Authorization": f"Bearer {c_token}"}, json={
        "mission_id": mission["id"],
        "client_id": c["id"],
        "prestataire_id": p["id"],
        "rating": 5,
        "comment": "Excellent travail",
    })
    assert resp.status_code == 201
    assert resp.json()["rating"] == 5


@pytest.mark.integration
def test_prestataire_cannot_post_review(client):
    c, c_token = _reg_login(client, "Client R2", "699430003", "client")
    p, p_token = _reg_login(client, "Presta R2", "699430004", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.post("/api/v1/reviews", headers={"Authorization": f"Bearer {p_token}"}, json={
        "mission_id": mission["id"],
        "client_id": c["id"],
        "prestataire_id": p["id"],
        "rating": 3,
        "comment": "",
    })
    assert resp.status_code == 403


@pytest.mark.integration
def test_review_rating_out_of_range_rejected(client):
    c, c_token = _reg_login(client, "Client R3", "699430005", "client")
    p, p_token = _reg_login(client, "Presta R3", "699430006", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    resp = client.post("/api/v1/reviews", headers={"Authorization": f"Bearer {c_token}"}, json={
        "mission_id": mission["id"],
        "client_id": c["id"],
        "prestataire_id": p["id"],
        "rating": 6,
        "comment": "",
    })
    assert resp.status_code == 422


@pytest.mark.integration
def test_list_reviews_returns_created(client):
    c, c_token = _reg_login(client, "Client R4", "699430007", "client")
    p, p_token = _reg_login(client, "Presta R4", "699430008", "prestataire")
    dem = _demande(client, c_token, c["id"])
    mission = _mission(client, p_token, dem["id"], c["id"], p["id"]).json()
    client.post("/api/v1/reviews", headers={"Authorization": f"Bearer {c_token}"}, json={
        "mission_id": mission["id"], "client_id": c["id"], "prestataire_id": p["id"],
        "rating": 4, "comment": "Bien",
    })
    resp = client.get("/api/v1/reviews", headers={"Authorization": f"Bearer {c_token}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1
