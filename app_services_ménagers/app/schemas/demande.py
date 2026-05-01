from datetime import datetime

from enum import StrEnum

from pydantic import Field

from app.schemas.common import AppBaseModel


class DemandeStatus(StrEnum):
    OUVERTE = "ouverte"
    ATTRIBUEE = "attribuee"
    ANNULEE = "annulee"
    EXPIREE = "expiree"


class DemandeCreate(AppBaseModel):
    client_id: int
    description: str = Field(min_length=5)
    location: str = Field(min_length=3, max_length=255)


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
    description: str
    location: str
    status: DemandeStatus
    created_at: datetime
    updated_at: datetime
    events: list[DemandeEventRead] = Field(default_factory=list)
