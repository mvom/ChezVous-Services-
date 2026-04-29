import pytest

from app.core.security import create_access_token, decode_token, hash_password, verify_password


@pytest.mark.unit
def test_hash_and_verify_password_roundtrip():
    plain = "super-secret-123"
    password_hash = hash_password(plain)

    assert password_hash != plain
    assert verify_password(plain, password_hash) is True
    assert verify_password("bad-password", password_hash) is False


@pytest.mark.unit
def test_create_and_decode_token():
    token = create_access_token(user_id=42, role="client")
    payload = decode_token(token)

    assert payload["sub"] == "42"
    assert payload["role"] == "client"
    assert "exp" in payload


@pytest.mark.unit
def test_decode_invalid_token_raises_value_error():
    with pytest.raises(ValueError):
        decode_token("invalid.token.value")
