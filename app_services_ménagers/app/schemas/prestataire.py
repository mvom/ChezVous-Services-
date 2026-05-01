from app.schemas.common import AppBaseModel


class PrestataireRead(AppBaseModel):
    user_id: int
    rating: float
    verified: bool


class PrestataireVerifyUpdate(AppBaseModel):
    verified: bool
