from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Client, Demande, Mission, Prestataire
from app.schemas.mission import MissionCreate, MissionRead, MissionStatus


class MissionsService:
    def create_mission(self, db: Session, payload: MissionCreate) -> MissionRead:
        if db.get(Demande, payload.demande_id) is None:
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
        db.refresh(mission)
        return MissionRead.model_validate(mission)

    def list_missions(self, db: Session) -> list[MissionRead]:
        missions = db.scalars(select(Mission).order_by(Mission.id)).all()
        return [MissionRead.model_validate(item) for item in missions]

    def get_mission(self, db: Session, mission_id: int) -> Mission:
        mission = db.get(Mission, mission_id)
        if mission is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission introuvable")
        return mission

    def update_status(self, db: Session, mission_id: int, new_status: MissionStatus) -> MissionRead:
        mission = self.get_mission(db, mission_id)
        mission.status = new_status
        db.commit()
        db.refresh(mission)
        return MissionRead.model_validate(mission)


missions_service = MissionsService()
