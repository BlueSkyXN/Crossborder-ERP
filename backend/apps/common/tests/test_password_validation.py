import pytest
from rest_framework import exceptions

from apps.common.validators import validate_password_strength


@pytest.mark.parametrize("password", ["password123", "12345678"])
def test_weak_common_passwords_are_rejected(password):
    with pytest.raises(exceptions.ValidationError):
        validate_password_strength(password)


@pytest.mark.parametrize("password", ["lowercase1", "UPPERCASE1", "NoDigitsHere"])
def test_passwords_missing_required_character_classes_are_rejected(password):
    with pytest.raises(exceptions.ValidationError):
        validate_password_strength(password)


def test_strong_password_passes():
    validate_password_strength("StrongerPass123")
