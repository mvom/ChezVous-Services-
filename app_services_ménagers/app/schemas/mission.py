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


class MissionUpdateStatus(AppBaseModel):
    status: MissionStatus


class MissionRead(AppBaseModel):
    id: int
    demande_id: int
    client_id: int
    prestataire_id: int
    service_id: Optional[int]
    status: MissionStatus
    created_at: datetime
    updated_at: datetime
