from datetime import datetime
from enum import StrEnum

from app.schemas.common import AppBaseModel


class VisibilityMode(StrEnum):
    PUBLIC = "public"
    DISCRET = "discret"
    ANONYME = "anonyme"


class PrestataireRead(AppBaseModel):
    user_id: int
    rating: float
    verified: bool
    visibility_mode: VisibilityMode = VisibilityMode.PUBLIC
    zone_preference_ville: str | None = None
    zone_preference_arrondissement: str | None = None
    zone_preference_quartier: str | None = None


class PrestataireVerifyUpdate(AppBaseModel):
    verified: bool


class VisibilityModeUpdate(AppBaseModel):
    visibility_mode: VisibilityMode


class ZonePreferenceUpdate(AppBaseModel):
    zone_preference_ville: str | None = None
    zone_preference_arrondissement: str | None = None
    zone_preference_quartier: str | None = None


class NotificationRead(AppBaseModel):
    id: int
    demande_id: int
    message: str
    is_read: bool
    created_at: datetime
