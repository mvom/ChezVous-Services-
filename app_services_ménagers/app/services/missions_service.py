from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Client, Demande, Mission, Prestataire
from app.schemas.demande import DemandeStatus
from app.schemas.mission import MissionCreate, MissionRead, MissionStatus
from app.services.demandes_service import record_demande_event
from app.db.models import User


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
        return MissionRead.model_validate(mission)

    def list_missions(self, db: Session) -> list[MissionRead]:
        missions = db.scalars(select(Mission).order_by(Mission.created_at.desc(), Mission.id.desc())).all()
        return [MissionRead.model_validate(item) for item in missions]

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
            return MissionRead.model_validate(mission)

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
        return MissionRead.model_validate(mission)


missions_service = MissionsService()
