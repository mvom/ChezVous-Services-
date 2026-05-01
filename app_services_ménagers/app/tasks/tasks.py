from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Badge, Client, Mission
from app.db.session import SessionLocal
from app.schemas.mission import MissionStatus
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.ping")
def ping() -> dict[str, str]:
    return {"status": "ok", "task": "ping"}


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _is_mission_delay_risk(mission: Mission, threshold_utc_naive: datetime) -> bool:
    if mission.status != MissionStatus.EN_COURS or mission.scheduled_at is None:
        return False
    return _to_utc_naive(mission.scheduled_at) <= threshold_utc_naive


def _serialize_at_risk_payload(now: datetime, threshold: datetime, rows: list[Mission]) -> dict[str, object]:
    missions = [
        {
            "mission_id": item.id,
            "demande_id": item.demande_id,
            "client_id": item.client_id,
            "prestataire_id": item.prestataire_id,
            "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
        }
        for item in rows
    ]
    return {
        "status": "ok",
        "checked_at": now.isoformat() + "Z",
        "threshold_at": threshold.isoformat() + "Z",
        "count": len(missions),
        "missions": missions,
    }


def build_delay_risk_payload(db: Session) -> dict[str, object]:
    """Builds API payload from persisted at_risk mission flags."""
    now = datetime.utcnow()
    threshold = now + timedelta(hours=2)
    rows = db.scalars(select(Mission).where(Mission.at_risk.is_(True)).order_by(Mission.id.asc())).all()
    return _serialize_at_risk_payload(now, threshold, rows)


def sync_delay_risk_flags(db: Session) -> dict[str, object]:
    """Computes risk and persists Mission.at_risk, clearing stale flags as needed."""
    now = datetime.utcnow()
    threshold = now + timedelta(hours=2)

    candidates = db.scalars(
        select(Mission).where(
            (Mission.status == MissionStatus.EN_COURS) | (Mission.at_risk.is_(True))
        )
    ).all()

    changed = False
    at_risk_rows: list[Mission] = []

    for mission in candidates:
        should_flag = _is_mission_delay_risk(mission, threshold)
        if mission.at_risk != should_flag:
            mission.at_risk = should_flag
            changed = True
        if should_flag:
            at_risk_rows.append(mission)

    if changed:
        db.commit()

    at_risk_rows.sort(
        key=lambda item: (
            _to_utc_naive(item.scheduled_at) if item.scheduled_at else datetime.max,
            item.id,
        )
    )
    return _serialize_at_risk_payload(now, threshold, at_risk_rows)


@celery_app.task(name="app.tasks.loyalty_credit")
def loyalty_credit(client_id: int, mission_id: int | None = None) -> dict[str, int | str]:
    """Idempotently credits loyalty points from completed client missions."""
    with SessionLocal() as db:
        client = db.get(Client, client_id)
        if client is None:
            return {"status": "noop", "reason": "client_not_found", "client_id": client_id}

        if mission_id is not None:
            mission = db.get(Mission, mission_id)
            if mission is None or mission.client_id != client_id or mission.status != MissionStatus.TERMINEE:
                return {"status": "noop", "reason": "mission_not_completed", "client_id": client_id}

        completed_count = db.scalar(
            select(func.count(Mission.id)).where(
                Mission.client_id == client_id,
                Mission.status == MissionStatus.TERMINEE,
            )
        )
        completed_count = int(completed_count or 0)

        delta = completed_count - int(client.completed_missions_count)
        if delta <= 0:
            return {
                "status": "noop",
                "client_id": client_id,
                "completed_missions_count": int(client.completed_missions_count),
                "loyalty_points": int(client.loyalty_points),
            }

        client.completed_missions_count = completed_count
        client.loyalty_points = int(client.loyalty_points) + (delta * 10)
        db.commit()

        return {
            "status": "ok",
            "client_id": client_id,
            "completed_missions_count": int(client.completed_missions_count),
            "loyalty_points": int(client.loyalty_points),
        }


@celery_app.task(name="app.tasks.award_badges")
def award_badges(prestataire_user_id: int) -> dict[str, object]:
    """Awards milestone badges to provider based on completed missions."""
    with SessionLocal() as db:
        completed_count = db.scalar(
            select(func.count(Mission.id)).where(
                Mission.prestataire_id == prestataire_user_id,
                Mission.status == MissionStatus.TERMINEE,
            )
        )
        completed_count = int(completed_count or 0)

        milestones = {
            5: "mission-5",
            10: "mission-10",
            20: "mission-20",
        }
        awarded: list[str] = []

        for threshold, slug in milestones.items():
            if completed_count < threshold:
                continue
            exists = db.scalar(
                select(Badge.id).where(Badge.user_id == prestataire_user_id, Badge.slug == slug)
            )
            if exists is not None:
                continue
            db.add(Badge(user_id=prestataire_user_id, slug=slug))
            awarded.append(slug)

        if awarded:
            db.commit()

        return {
            "status": "ok",
            "user_id": prestataire_user_id,
            "completed_missions": completed_count,
            "awarded": awarded,
        }


@celery_app.task(name="app.tasks.detect_delay_risk")
def detect_delay_risk() -> dict[str, object]:
    """Detects missions in progress that are scheduled soon and may be at risk."""
    with SessionLocal() as db:
        return sync_delay_risk_flags(db)
