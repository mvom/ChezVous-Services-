from enum import StrEnum

from pydantic import Field

from app.schemas.common import AppBaseModel


class UserRole(StrEnum):
    CLIENT = "client"
    PRESTATAIRE = "prestataire"
    ADMIN = "admin"


class UserCreate(AppBaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole


class UserRead(AppBaseModel):
    id: int
    full_name: str
    phone: str
    role: UserRole


class LoginRequest(AppBaseModel):
    phone: str = Field(min_length=8, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(AppBaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(AppBaseModel):
    user_id: int
    role: UserRole
