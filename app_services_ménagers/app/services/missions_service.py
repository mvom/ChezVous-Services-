from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Client, Demande, Mission, Prestataire, User
from app.schemas.demande import DemandeStatus
from app.schemas.mission import (
    MissionCreate,
    MissionRead,
    MissionStatus,
    PrestataireMissionSummaryRead,
    PrestataireTrustRead,
)
from app.services.demandes_service import record_demande_event


def _provider_display_name(user: User | None, prestataire_id: int) -> str:
    if user is None:
        return f"Prestataire #{prestataire_id}"
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.username or f"Prestataire #{prestataire_id}"


def _build_prestataire_summaries(
    db: Session,
    missions: list[Mission],
) -> dict[int, PrestataireMissionSummaryRead]:
    provider_ids = sorted({mission.prestataire_id for mission in missions})
    if not provider_ids:
        return {}

    prestataires = {
        item.user_id: item
        for item in db.scalars(select(Prestataire).where(Prestataire.user_id.in_(provider_ids))).all()
    }
    users = {
        item.id: item
        for item in db.scalars(select(User).where(User.id.in_(provider_ids))).all()
    }

    provider_missions = db.scalars(
        select(Mission).where(Mission.prestataire_id.in_(provider_ids)).order_by(Mission.created_at.asc(), Mission.id.asc())
    ).all()
    demande_ids = sorted({mission.demande_id for mission in provider_missions})
    demandes = {}
    if demande_ids:
        demandes = {
            item.id: item
            for item in db.scalars(select(Demande).where(Demande.id.in_(demande_ids))).all()
        }

    stats_by_provider: dict[int, dict[str, list[int] | int]] = defaultdict(
        lambda: {
            "total": 0,
            "completed": 0,
            "scheduled": 0,
            "response_minutes": [],
        }
    )

    for mission in provider_missions:
        stats = stats_by_provider[mission.prestataire_id]
        stats["total"] += 1
        if mission.status == MissionStatus.TERMINEE:
            stats["completed"] += 1
        if mission.scheduled_at is not None:
            stats["scheduled"] += 1

        demande = demandes.get(mission.demande_id)
        if demande is not None and mission.created_at is not None and demande.created_at is not None:
            delta_minutes = int(max((mission.created_at - demande.created_at).total_seconds(), 0) // 60)
            response_minutes = stats["response_minutes"]
            assert isinstance(response_minutes, list)
            response_minutes.append(delta_minutes)

    summaries: dict[int, PrestataireMissionSummaryRead] = {}
    for provider_id in provider_ids:
        prestataire = prestataires.get(provider_id)
        user = users.get(provider_id)
        stats = stats_by_provider[provider_id]
        total = int(stats["total"])
        completed = int(stats["completed"])
        scheduled = int(stats["scheduled"])
        response_minutes = stats["response_minutes"]
        assert isinstance(response_minutes, list)
        average_response_minutes = round(sum(response_minutes) / len(response_minutes)) if response_minutes else None
        eta_reliability_percent = round((scheduled / total) * 100) if total > 0 else 0

        summaries[provider_id] = PrestataireMissionSummaryRead(
            user_id=provider_id,
            display_name=_provider_display_name(user, provider_id),
            avatar_url=user.avatar_url if user else None,
            trust=PrestataireTrustRead(
                verified=bool(prestataire.verified) if prestataire else False,
                rating=float(prestataire.rating) if prestataire and prestataire.rating is not None else 0.0,
                completed_missions=completed,
                total_missions=total,
                average_response_minutes=average_response_minutes,
                eta_reliability_percent=eta_reliability_percent,
            ),
        )

    return summaries


def _mission_to_read(db: Session, mission: Mission, summary_map: dict[int, PrestataireMissionSummaryRead] | None = None) -> MissionRead:
    return MissionRead(
        id=mission.id,
        demande_id=mission.demande_id,
        client_id=mission.client_id,
        prestataire_id=mission.prestataire_id,
        service_id=mission.service_id,
        status=mission.status,
        scheduled_at=mission.scheduled_at,
        created_at=mission.created_at,
        updated_at=mission.updated_at,
        prestataire_summary=(summary_map or {}).get(mission.prestataire_id),
    )


class MissionsService:
    def create_mission(self, db: Session, payload: MissionCreate, actor_user: User | None = None) -> MissionRead:
        demande = db.get(Demande, payload.demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Demande invalide")
        if db.get(Client, payload.client_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client invalide")
        if db.get(Prestataire, payload.prestataire_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prestataire invalide")

        mission = Mission(status=MissionStatus.EN_ATTENTE, **payload.model_dump())
        db.add(mission)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une mission existe deja pour cette demande",
            ) from exc

        if demande.status != DemandeStatus.ATTRIBUEE:
            previous_status = demande.status.value
            demande.status = DemandeStatus.ATTRIBUEE
            record_demande_event(
                db,
                demande,
                event_type="attribuee",
                actor_user=actor_user,
                previous_status=previous_status,
                new_status=DemandeStatus.ATTRIBUEE.value,
            )
            db.commit()

        db.refresh(mission)
        return _mission_to_read(db, mission, _build_prestataire_summaries(db, [mission]))

    def list_missions(self, db: Session) -> list[MissionRead]:
        missions = db.scalars(select(Mission).order_by(Mission.created_at.desc(), Mission.id.desc())).all()
        summary_map = _build_prestataire_summaries(db, missions)
        return [_mission_to_read(db, item, summary_map) for item in missions]

    def get_mission(self, db: Session, mission_id: int) -> Mission:
        mission = db.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission introuvable")
        return mission

    def update_status(
        self,
        db: Session,
        mission_id: int,
        new_status: MissionStatus,
        actor_user: User | None = None,
    ) -> MissionRead:
        mission = self.get_mission(db, mission_id)
        previous_status = mission.status
        if previous_status == new_status:
            return _mission_to_read(db, mission, _build_prestataire_summaries(db, [mission]))

        mission.status = new_status

        if new_status in (MissionStatus.EN_COURS, MissionStatus.TERMINEE):
            demande = db.get(Demande, mission.demande_id)
            if demande is not None:
                record_demande_event(
                    db,
                    demande,
                    event_type=new_status.value,
                    actor_user=actor_user,
                    previous_status=previous_status.value,
                    new_status=new_status.value,
                )

        db.commit()
        db.refresh(mission)
        return _mission_to_read(db, mission, _build_prestataire_summaries(db, [mission]))


missions_service = MissionsService()
