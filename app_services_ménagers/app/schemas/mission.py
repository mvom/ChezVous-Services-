from datetime import datetime

from enum import StrEnum
from typing import Optional

from pydantic import Field

from app.schemas.common import AppBaseModel


class MissionStatus(StrEnum):
    EN_ATTENTE = "en_attente"
    ACCEPTEE = "acceptee"
    CONFIRMEE = "confirmee"
    EN_COURS = "en_cours"
    TERMINEE = "terminee"
    ANNULEE = "annulee"
    LITIGE = "litige"


class MissionCreate(AppBaseModel):
    demande_id: int
    client_id: int
    prestataire_id: int
    service_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None


class MissionUpdateStatus(AppBaseModel):
    status: MissionStatus


class PrestataireTrustRead(AppBaseModel):
    verified: bool = False
    rating: float = 0.0
    completed_missions: int = 0
    total_missions: int = 0
    average_response_minutes: int | None = None
    eta_reliability_percent: int = 0


class PrestataireMissionSummaryRead(AppBaseModel):
    user_id: int
    display_name: str
    avatar_url: str | None = None
    trust: PrestataireTrustRead


class MissionRead(AppBaseModel):
    id: int
    demande_id: int
    client_id: int
    prestataire_id: int
    service_id: Optional[int]
    status: MissionStatus
    at_risk: bool = False
    scheduled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    prestataire_summary: PrestataireMissionSummaryRead | None = None


class MissionAtRiskItemRead(AppBaseModel):
    mission_id: int
    demande_id: int
    client_id: int
    prestataire_id: int
    scheduled_at: datetime | None = None


class MissionAtRiskRead(AppBaseModel):
    status: str
    checked_at: datetime
    threshold_at: datetime
    count: int
    missions: list[MissionAtRiskItemRead] = Field(default_factory=list)
