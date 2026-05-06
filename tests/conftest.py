import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.db.models import Base
from app.main import app


test_engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register_user(client: TestClient, *, full_name: str, phone: str, password: str, role: str) -> dict:
    tokens = full_name.split()
    first_name = tokens[0] if tokens else "Utilisateur"
    last_name = " ".join(tokens[1:]) if len(tokens) > 1 else "Test"
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) >= 9:
        digits = digits[-9:]
    else:
        digits = digits.rjust(9, "0")

    response = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": first_name,
            "last_name": last_name,
            "username": f"{first_name.lower()}.{last_name.lower().replace(' ', '.')}.{digits[-3:]}",
            "email": f"{first_name.lower()}.{last_name.lower().replace(' ', '.')}@example.com",
            "address": "Adresse de test, Yaounde",
            "phone": f"+237 {digits[0:3]} {digits[3:6]} {digits[6:9]}",
            "password": password,
            "role": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def login_user(client: TestClient, *, phone: str, password: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) >= 9:
        digits = digits[-9:]
    else:
        digits = digits.rjust(9, "0")

    response = client.post(
        "/api/v1/auth/login",
        json={"phone": f"+237 {digits[0:3]} {digits[3:6]} {digits[6:9]}", "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.cookies.get("access_token")
    assert token is not None, "Login did not set access_token cookie"
    return token
