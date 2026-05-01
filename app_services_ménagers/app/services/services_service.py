from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Prestataire, Service
from app.schemas.service import ServiceCreate, ServiceRead


class ServicesService:
    def create_service(self, db: Session, payload: ServiceCreate) -> ServiceRead:
        prestataire = db.get(Prestataire, payload.prestataire_id)
        if prestataire is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prestataire invalide")

        service = Service(
            prestataire_id=payload.prestataire_id,
            name=payload.name,
            description=payload.description,
            price=payload.price,
            is_active=True,
        )
        db.add(service)
        db.commit()
        db.refresh(service)
        return ServiceRead.model_validate(service)

    def list_services(self, db: Session, prestataire_id: int | None = None) -> list[ServiceRead]:
        stmt = select(Service).order_by(Service.created_at.desc(), Service.id.desc())
        if prestataire_id is not None:
            stmt = stmt.where(Service.prestataire_id == prestataire_id)
        services = db.scalars(stmt).all()
        return [ServiceRead.model_validate(item) for item in services]

    def get_service(self, db: Session, service_id: int) -> Service:
        service = db.get(Service, service_id)
        if service is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service introuvable")
        return service


services_service = ServicesService()
