import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_ENV_FILE = BASE_DIR / ".env"

load_dotenv(os.getenv("APP_ENV_FILE", DEFAULT_ENV_FILE), override=False)


def _split_csv_env(name: str, default: str) -> list[str]:
	raw_value = os.getenv(name, default)
	return [item.strip() for item in raw_value.split(",") if item.strip()]


def _as_bool(value: str | None, default: bool) -> bool:
	if value is None:
		return default
	return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
	app_name: str = os.getenv("APP_NAME", "API Services Menagers")
	app_version: str = os.getenv("APP_VERSION", "0.1.0")
	app_env: str = os.getenv("APP_ENV", "development")
	app_debug: bool = _as_bool(os.getenv("APP_DEBUG"), False)
	log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
	log_json: bool = _as_bool(os.getenv("LOG_JSON"), True)
	log_to_file: bool = _as_bool(os.getenv("LOG_TO_FILE"), True)
	log_file_path: str = os.getenv("LOG_FILE_PATH", str(BASE_DIR / "logs" / "app.log"))
	log_max_bytes: int = int(os.getenv("LOG_MAX_BYTES", str(5 * 1024 * 1024)))
	log_backup_count: int = int(os.getenv("LOG_BACKUP_COUNT", "5"))
	database_url: str = os.getenv(
		"DATABASE_URL",
		"postgresql+psycopg://postgres:postgres@localhost:5432/services_menagers",
	)
	jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
	jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
	jwt_expire_minutes: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
	cors_origins: list[str] = field(
		default_factory=lambda: _split_csv_env(
			"CORS_ORIGINS",
			"http://localhost:5500,http://127.0.0.1:5500",
		)
	)
	enable_request_logging: bool = _as_bool(os.getenv("ENABLE_REQUEST_LOGGING"), True)
	api_host: str = os.getenv("API_HOST", "0.0.0.0")
	api_port: int = int(os.getenv("API_PORT", "8000"))
	api_workers: int = int(os.getenv("API_WORKERS", "2"))


settings = Settings()

JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
JWT_EXPIRE_MINUTES = settings.jwt_expire_minutes
