from pydantic import Field

from app.schemas.common import AppBaseModel


class ReviewCreate(AppBaseModel):
    mission_id: int
    client_id: int
    prestataire_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewRead(AppBaseModel):
    id: int
    mission_id: int
    client_id: int
    prestataire_id: int
    rating: int
    comment: str
