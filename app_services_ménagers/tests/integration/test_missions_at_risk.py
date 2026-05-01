from datetime import datetime, timedelta

import pytest

from app.core.security import hash_password
from app.db.models import Mission, User
from app.schemas.mission import MissionStatus
from app.schemas.user import UserRole
from tests.conftest import login_user, register_user


def create_admin(db_session) -> User:
    admin = User(
        first_name="Admin",
        last_name="Risk",
        username="admin.risk",
        email="admin.risk@example.com",
        address="Douala, Akwa",
        phone="+237 699 811 700",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.mark.integration
def test_detect_delay_risk_persists_and_clears_flag(client, db_session):
    create_admin(db_session)

    customer = register_user(
        client,
        full_name="Client Risk",
        phone="699811001",
        password="password123",
        role="client",
    )
    provider = register_user(
        client,
        full_name="Provider Risk",
        phone="699811002",
        password="password123",
        role="prestataire",
    )

    customer_token = login_user(client, phone="699811001", password="password123")
    provider_token = login_user(client, phone="699811002", password="password123")
    admin_token = login_user(client, phone="699811700", password="password123")

    demande_created = client.post(
        "/api/v1/demandes",
        headers={"Authorization": f"Bearer {customer_token}"},
        json={
            "client_id": customer["id"],
            "description": "Intervention urgente entretien",
            "location": "Douala, Akwa",
            "ville": "Douala",
            "arrondissement": "Douala 1",
            "quartier": "Akwa",
            "client_availability_mode": "flexible",
            "priority": "haute",
        },
    )
    assert demande_created.status_code == 201, demande_created.text
    demande_id = demande_created.json()["id"]

    scheduled_soon = (datetime.utcnow() + timedelta(minutes=90)).isoformat()
    mission_created = client.post(
        "/api/v1/missions",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={
            "demande_id": demande_id,
            "client_id": customer["id"],
            "prestataire_id": provider["id"],
            "scheduled_at": scheduled_soon,
        },
    )
    assert mission_created.status_code == 201, mission_created.text
    mission_id = mission_created.json()["id"]

    in_progress = client.patch(
        f"/api/v1/missions/{mission_id}/status",
        headers={"Authorization": f"Bearer {provider_token}"},
        json={"status": "en_cours"},
    )
    assert in_progress.status_code == 200, in_progress.text

    admin_view = client.get(
        "/api/v1/missions/at-risk",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_view.status_code == 200, admin_view.text
    assert admin_view.json()["count"] == 1
    assert admin_view.json()["missions"][0]["mission_id"] == mission_id

    mission = db_session.get(Mission, mission_id)
    assert mission is not None
    assert mission.at_risk is True

    mission.status = MissionStatus.TERMINEE
    db_session.commit()

    admin_view = client.get(
        "/api/v1/missions/at-risk",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_view.status_code == 200, admin_view.text
    assert admin_view.json()["count"] == 0

    mission = db_session.get(Mission, mission_id)
    assert mission is not None
    assert mission.at_risk is False
