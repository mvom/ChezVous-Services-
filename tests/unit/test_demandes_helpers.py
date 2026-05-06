"""Tests unitaires pour les helpers purs de demandes_service."""
import pytest
from unittest.mock import MagicMock

from app.domains.demandes.service import _actor_label
from app.schemas.user import UserRole


@pytest.mark.unit
def test_actor_label_returns_none_when_user_is_none():
    assert _actor_label(None) is None


@pytest.mark.unit
def test_actor_label_uses_full_name_and_role():
    user = MagicMock()
    user.first_name = "Alice"
    user.last_name = "Dupont"
    user.role = UserRole.CLIENT
    user.id = 1
    label = _actor_label(user, UserRole.CLIENT)
    assert "Alice Dupont" in label
    assert "client" in label


@pytest.mark.unit
def test_actor_label_uses_id_when_name_is_blank():
    user = MagicMock()
    user.first_name = ""
    user.last_name = ""
    user.role = UserRole.PRESTATAIRE
    user.id = 42
    label = _actor_label(user, UserRole.PRESTATAIRE)
    assert "42" in label


@pytest.mark.unit
def test_actor_label_uses_user_role_when_actor_role_is_none():
    user = MagicMock()
    user.first_name = "Bob"
    user.last_name = "Builder"
    user.role = UserRole.ADMIN
    user.id = 10
    label = _actor_label(user, None)
    assert "admin" in label
