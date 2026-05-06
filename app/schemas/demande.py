from datetime import datetime

from enum import StrEnum

from pydantic import Field, field_validator

from app.schemas.common import AppBaseModel


class DemandeStatus(StrEnum):
    OUVERTE = "ouverte"
    ATTRIBUEE = "attribuee"
    ANNULEE = "annulee"
    EXPIREE = "expiree"


class DemandePriority(StrEnum):
    HAUTE = "haute"
    NORMALE = "normale"
    BASSE = "basse"


class ClientAvailabilityMode(StrEnum):
    FLEXIBLE = "flexible"
    FIXE = "fixe"


class DemandeCategory(StrEnum):
    MENAGE = "menage"
    PLOMBERIE = "plomberie"
    ELECTRICITE = "electricite"
    MECANIQUE_AUTO = "mecanique_auto"
    SOUDURE = "soudure"
    EVENEMENTIEL = "evenementiel"
    REPARATION_ELECTRONIQUE = "reparation_electronique"
    CLIMATISATION = "climatisation"


class DemandeCreate(AppBaseModel):
    client_id: int
    category: DemandeCategory = DemandeCategory.MENAGE
    description: str = Field(min_length=5)
    location: str | None = Field(default=None, min_length=3, max_length=255)
    ville: str = Field(min_length=2, max_length=80)
    arrondissement: str = Field(min_length=2, max_length=80)
    quartier: str = Field(min_length=2, max_length=120)
    client_availability_mode: ClientAvailabilityMode = ClientAvailabilityMode.FLEXIBLE
    client_availability_note: str | None = Field(default=None, max_length=255)
    priority: DemandePriority = DemandePriority.NORMALE
    sub_services: list[str] = Field(default_factory=list)


class DemandeClientUpdate(AppBaseModel):
    category: DemandeCategory = DemandeCategory.MENAGE
    description: str = Field(min_length=5)
    location: str | None = Field(default=None, min_length=3, max_length=255)
    ville: str = Field(min_length=2, max_length=80)
    arrondissement: str = Field(min_length=2, max_length=80)
    quartier: str = Field(min_length=2, max_length=120)
    client_availability_mode: ClientAvailabilityMode = ClientAvailabilityMode.FLEXIBLE
    client_availability_note: str | None = Field(default=None, max_length=255)
    priority: DemandePriority = DemandePriority.NORMALE
    sub_services: list[str] = Field(default_factory=list)


class DemandeUpdateStatus(AppBaseModel):
    status: DemandeStatus


class DemandeEventRead(AppBaseModel):
    id: int
    event_type: str
    previous_status: str | None = None
    new_status: str | None = None
    actor_user_id: int | None = None
    actor_label: str | None = None
    created_at: datetime


class DemandeRead(AppBaseModel):
    id: int
    client_id: int
    category: str = "menage"
    description: str
    location: str
    ville: str | None = None
    arrondissement: str | None = None
    quartier: str | None = None
    client_availability_mode: str = "flexible"
    client_availability_note: str | None = None
    priority: str = "normale"
    sub_services: list[str] = Field(default_factory=list)
    status: DemandeStatus
    created_at: datetime
    updated_at: datetime
    events: list[DemandeEventRead] = Field(default_factory=list)

    @field_validator("sub_services", mode="before")
    @classmethod
    def coerce_sub_services(cls, v: object) -> list[str]:
        if v is None:
            return []
        return v
