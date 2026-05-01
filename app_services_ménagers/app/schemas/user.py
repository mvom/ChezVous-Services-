from enum import StrEnum
import re

from pydantic import Field, field_validator, model_validator

from app.schemas.common import AppBaseModel


class UserRole(StrEnum):
    CLIENT = "client"
    PRESTATAIRE = "prestataire"
    ADMIN = "admin"


PHONE_CANONICAL_PATTERN = re.compile(r"^\+237\s\d{3}\s\d{3}\s\d{3}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_person_name(value: str) -> str:
    cleaned = " ".join(value.strip().split())
    if not cleaned:
        return cleaned

    def cap_token(token: str) -> str:
        parts = [
            "'".join(piece[:1].upper() + piece[1:].lower() for piece in segment.split("'"))
            for segment in token.split("-")
        ]
        return "-".join(parts)

    return " ".join(cap_token(token) for token in cleaned.split(" "))


def _normalize_phone(value: str) -> str:
    compact = re.sub(r"\s+", "", value.strip())
    if re.fullmatch(r"\d{9}", compact):
        compact = f"+237{compact}"
    if not re.fullmatch(r"\+237\d{9}", compact):
        raise ValueError("Le numero doit respecter le format +237 xxx xxx xxx")
    digits = compact[-9:]
    return f"+237 {digits[0:3]} {digits[3:6]} {digits[6:9]}"


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("Adresse email invalide")
    return normalized


def _normalize_username(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9._]{3,30}", normalized):
        raise ValueError("Le nom d'utilisateur doit contenir 3-30 caracteres: a-z, 0-9, point ou underscore")
    return normalized


class UserCreate(AppBaseModel):
    first_name: str = Field(min_length=2, max_length=60)
    last_name: str = Field(min_length=2, max_length=60)
    username: str = Field(min_length=3, max_length=30)
    email: str = Field(min_length=5, max_length=255)
    address: str = Field(min_length=5, max_length=255)
    phone: str = Field(min_length=8, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, value):
        if not isinstance(value, dict):
            return value
        payload = dict(value)
        role = payload.get("role")
        if role is not None:
            payload["role"] = str(role).strip().lower()
        return payload

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_names(cls, value: str) -> str:
        normalized = _normalize_person_name(str(value))
        if len(normalized) < 2:
            raise ValueError("Ce champ doit contenir au moins 2 caracteres")
        return normalized

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        normalized = _normalize_phone(str(value))
        if not PHONE_CANONICAL_PATTERN.fullmatch(normalized):
            raise ValueError("Le numero doit respecter le format +237 xxx xxx xxx")
        return normalized

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(str(value))

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return _normalize_username(str(value))

    @field_validator("address", mode="before")
    @classmethod
    def normalize_address(cls, value: str) -> str:
        normalized = " ".join(str(value).strip().split())
        if len(normalized) < 5:
            raise ValueError("Adresse trop courte")
        return normalized


class UserRead(AppBaseModel):
    id: int
    first_name: str
    last_name: str
    username: str
    email: str
    address: str
    phone: str
    role: UserRole
    avatar_url: str | None = None


class AvatarUpdate(AppBaseModel):
    avatar_url: str


class LoginRequest(AppBaseModel):
    phone: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        raw = str(value).strip()
        compact = re.sub(r"\s+", "", raw)
        if re.fullmatch(r"(\+237\d{9}|\d{9})", compact):
            return _normalize_phone(raw)
        return _normalize_username(raw)


class UnregisterRequest(AppBaseModel):
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(AppBaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(AppBaseModel):
    user_id: int
    role: UserRole
