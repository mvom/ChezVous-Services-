from datetime import datetime

from pydantic import Field

from app.schemas.common import AppBaseModel


class ServiceCreate(AppBaseModel):
    prestataire_id: int
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    price: float = Field(ge=0)


class ServiceRead(AppBaseModel):
    id: int
    prestataire_id: int
    name: str
    description: str
    price: float
    is_active: bool
    created_at: datetime
    updated_at: datetime
