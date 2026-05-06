from fastapi import HTTPException, status

from app.db.models import Service
from .repository import ServicesRepository
from .schemas import ServiceCreate, ServiceRead


class ServicesService:
    def __init__(self, repo: ServicesRepository) -> None:
        self.repo = repo

    def create_service(self, payload: ServiceCreate) -> ServiceRead:
        if self.repo.get_prestataire(payload.prestataire_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prestataire invalide")

        service = Service(
            prestataire_id=payload.prestataire_id,
            name=payload.name,
            description=payload.description,
            availability_slots=payload.availability_slots.strip(),
            price=payload.price,
            is_active=True,
        )
        self.repo.add_service(service)
        self.repo.commit()
        self.repo.refresh(service)
        return ServiceRead.model_validate(service)

    def list_services(self, prestataire_id: int | None = None) -> list[ServiceRead]:
        return [ServiceRead.model_validate(item) for item in self.repo.list_services(prestataire_id)]

    def get_service(self, service_id: int) -> Service:
        service = self.repo.get_service(service_id)
        if service is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service introuvable")
        return service
