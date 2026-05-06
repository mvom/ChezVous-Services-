from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Prestataire, Service


class ServicesRepository(Protocol):
    def get_prestataire(self, prestataire_id: int) -> Prestataire | None:
        ...

    def get_service(self, service_id: int) -> Service | None:
        ...

    def add_service(self, service: Service) -> None:
        ...

    def list_services(self, prestataire_id: int | None = None) -> list[Service]:
        ...

    def commit(self) -> None:
        ...

    def refresh(self, service: Service) -> None:
        ...


class SqlAlchemyServicesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_prestataire(self, prestataire_id: int) -> Prestataire | None:
        return self.db.get(Prestataire, prestataire_id)

    def get_service(self, service_id: int) -> Service | None:
        return self.db.get(Service, service_id)

    def add_service(self, service: Service) -> None:
        self.db.add(service)

    def list_services(self, prestataire_id: int | None = None) -> list[Service]:
        stmt = select(Service).order_by(Service.created_at.desc(), Service.id.desc())
        if prestataire_id is not None:
            stmt = stmt.where(Service.prestataire_id == prestataire_id)
        return self.db.scalars(stmt).all()

    def commit(self) -> None:
        self.db.commit()

    def refresh(self, service: Service) -> None:
        self.db.refresh(service)
