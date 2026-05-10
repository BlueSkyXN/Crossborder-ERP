"""Shared password strength validation."""
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import exceptions


def validate_password_strength(password: str) -> None:
    """Reject passwords that are too weak for production use.

    Rules:
    - Minimum 8 characters (also enforced by serializer min_length)
    - Must contain at least one uppercase letter
    - Must contain at least one lowercase letter
    - Must contain at least one digit
    - Must not be in a common weak password list
    """
    errors = []
    if len(password) < 8:
        errors.append("密码长度至少 8 位")
    if not re.search(r"[A-Z]", password):
        errors.append("密码必须包含至少一个大写字母")
    if not re.search(r"[a-z]", password):
        errors.append("密码必须包含至少一个小写字母")
    if not re.search(r"\d", password):
        errors.append("密码必须包含至少一个数字")

    WEAK_PASSWORDS = {
        "password123", "12345678", "qwerty123", "abc12345",
        "password1", "admin123", "iloveyou1", "welcome1",
    }
    if password.lower() in WEAK_PASSWORDS:
        errors.append("密码过于常见，请使用更安全的密码")

    if errors:
        raise exceptions.ValidationError({"password": errors})
