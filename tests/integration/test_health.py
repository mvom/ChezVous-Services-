import pytest


@pytest.mark.integration
def test_health_endpoint_returns_service_metadata(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "API Services Menagers"


@pytest.mark.integration
def test_ready_endpoint_reports_database_up(client):
    response = client.get("/ready")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "up"
    assert data["environment"] == "development"
    assert "redis" in data  # "up" en prod, "down"/"unavailable" en test