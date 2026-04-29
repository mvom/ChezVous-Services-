from enum import StrEnum

from pydantic import Field

from app.schemas.common import AppBaseModel


class PaiementStatus(StrEnum):
    EN_ATTENTE = "en_attente"
    PAYE = "paye"
    ECHOUE = "echoue"
    REMBOURSE = "rembourse"


class PaiementMethod(StrEnum):
    MOBILE_MONEY = "mobile_money"
    CARTE = "carte"
    VIREMENT = "virement"
    ESPECES = "especes"


class PaiementCreate(AppBaseModel):
    mission_id: int
    amount: float = Field(ge=0)
    method: PaiementMethod


class PaiementUpdateStatus(AppBaseModel):
    status: PaiementStatus


class PaiementRead(AppBaseModel):
    id: int
    mission_id: int
    amount: float
    status: PaiementStatus
    method: PaiementMethod
