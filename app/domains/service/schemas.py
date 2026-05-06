from datetime import datetime

from pydantic import Field

from app.schemas.common import AppBaseModel


class ServiceCreate(AppBaseModel):
    prestataire_id: int
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    availability_slots: str = Field(min_length=3, max_length=1000)
    price: float | None = Field(default=None, ge=0)


class ServiceRead(AppBaseModel):
    id: int
    prestataire_id: int
    name: str
    description: str
    availability_slots: str
    price: float | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
