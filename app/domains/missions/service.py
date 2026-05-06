from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Client, Demande, Mission, Prestataire, User
from app.domains.demandes.repository import SqlAlchemyDemandesRepository
from app.domains.demandes.service import record_demande_event
from app.domains.missions.repository import MissionsRepository, SqlAlchemyMissionsRepository
from app.schemas.demande import DemandeStatus
from app.schemas.mission import (
    MissionCreate,
    MissionRead,
    MissionStatus,
    PrestataireMissionSummaryRead,
    PrestataireTrustRead,
)
from app.schemas.prestataire import VisibilityMode
from app.tasks.tasks import award_badges, loyalty_credit


def _provider_display_name(user: User | None, prestataire_id: int, visibility_mode: VisibilityMode = VisibilityMode.PUBLIC) -> str:
    if user is None:
        return f"Prestataire #{prestataire_id}"
    if visibility_mode == VisibilityMode.ANONYME:
        return "Prestataire anonyme"
    if visibility_mode == VisibilityMode.DISCRET:
        first = user.first_name or ""
        last_initial = (user.last_name or "")[:1]
        return f"{first} {last_initial}." if last_initial else first or f"Prestataire #{prestataire_id}"
    # PUBLIC
    full_name = f"{user.first_name} {user.last_name}".strip()
    return full_name or user.username or f"Prestataire #{prestataire_id}"


def _build_prestataire_summaries(
    repo: MissionsRepository,
    missions: list[Mission],
) -> dict[int, PrestataireMissionSummaryRead]:
    provider_ids = sorted({mission.prestataire_id for mission in missions})
    if not provider_ids:
        return {}

    prestataires = {
        item.user_id: item
        for item in repo.list_prestataires_by_ids(provider_ids)
    }
    users = {
        item.id: item
        for item in repo.list_users_by_ids(provider_ids)
    }

    provider_missions = repo.list_missions_by_prestataire_ids(provider_ids)
    demande_ids = sorted({mission.demande_id for mission in provider_missions})
    demandes = {}
    if demande_ids:
        demandes = {
            item.id: item
            for item in repo.list_demandes_by_ids(demande_ids)
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

        visibility_mode = VisibilityMode(prestataire.visibility_mode) if prestataire and prestataire.visibility_mode else VisibilityMode.PUBLIC
        is_anonymous = visibility_mode == VisibilityMode.ANONYME

        summaries[provider_id] = PrestataireMissionSummaryRead(
            user_id=provider_id,
            display_name=_provider_display_name(user, provider_id, visibility_mode),
            avatar_url=None if is_anonymous else (user.avatar_url if user else None),
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
    def __init__(self, repository_factory: Callable[[Session], MissionsRepository] | None = None) -> None:
        self._repository_factory = repository_factory or (lambda db: SqlAlchemyMissionsRepository(db))

    def _repo(self, db: Session) -> MissionsRepository:
        return self._repository_factory(db)

    def create_mission(self, db: Session, payload: MissionCreate, actor_user: User | None = None) -> MissionRead:
        repo = self._repo(db)
        demande = repo.get_demande(payload.demande_id)
        if demande is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Demande invalide")
        if repo.get_client(payload.client_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client invalide")
        if repo.get_prestataire(payload.prestataire_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prestataire invalide")

        mission = Mission(status=MissionStatus.EN_ATTENTE, **payload.model_dump())
        repo.add_mission(mission)
        try:
            repo.commit()
        except IntegrityError as exc:
            repo.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une mission existe deja pour cette demande",
            ) from exc

        if demande.status != DemandeStatus.ATTRIBUEE:
            previous_status = demande.status.value
            demande.status = DemandeStatus.ATTRIBUEE
            record_demande_event(
                SqlAlchemyDemandesRepository(db),
                demande,
                event_type="attribuee",
                actor_user=actor_user,
                previous_status=previous_status,
                new_status=DemandeStatus.ATTRIBUEE.value,
            )
            repo.commit()

        repo.refresh_mission(mission)
        return _mission_to_read(db, mission, _build_prestataire_summaries(repo, [mission]))

    def list_missions(self, db: Session) -> list[MissionRead]:
        repo = self._repo(db)
        missions = repo.list_missions()
        summary_map = _build_prestataire_summaries(repo, list(missions))
        return [_mission_to_read(db, item, summary_map) for item in missions]

    def get_mission(self, db: Session, mission_id: int) -> Mission:
        repo = self._repo(db)
        mission = repo.get_mission(mission_id)
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
        repo = self._repo(db)
        mission = self.get_mission(db, mission_id)
        previous_status = mission.status
        if previous_status == new_status:
            return _mission_to_read(db, mission, _build_prestataire_summaries(repo, [mission]))

        mission.status = new_status
        if new_status != MissionStatus.EN_COURS:
            mission.at_risk = False

        if new_status in (MissionStatus.EN_COURS, MissionStatus.TERMINEE):
            demande = repo.get_demande(mission.demande_id)
            if demande is not None:
                record_demande_event(
                    SqlAlchemyDemandesRepository(db),
                    demande,
                    event_type=new_status.value,
                    actor_user=actor_user,
                    previous_status=previous_status.value,
                    new_status=new_status.value,
                )

        repo.commit()
        repo.refresh_mission(mission)

        if new_status == MissionStatus.TERMINEE and previous_status != MissionStatus.TERMINEE:
            award_badges.delay(mission.prestataire_id)
            loyalty_credit.delay(mission.client_id, mission.id)

        return _mission_to_read(db, mission, _build_prestataire_summaries(repo, [mission]))


missions_service = MissionsService()
