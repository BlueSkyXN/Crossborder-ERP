"""
Production settings for Crossborder ERP.

This module enforces security-critical configuration. The application will
refuse to start in production mode if required environment variables are
missing or unsafe.
"""
import sys

from .base import *  # noqa: F403
from .base import SECRET_KEY, ALLOWED_HOSTS, env

DEBUG = False

# ---------------------------------------------------------------------------
# Startup validation — fail fast on missing critical production config
# ---------------------------------------------------------------------------
_DEV_SECRET_PREFIX = "dev-secret-"
_errors: list[str] = []

if not SECRET_KEY or SECRET_KEY.startswith(_DEV_SECRET_PREFIX):
    _errors.append(
        "DJANGO_SECRET_KEY must be set to a unique production value "
        "(must not start with 'dev-secret-')."
    )

if not ALLOWED_HOSTS or ALLOWED_HOSTS == ["localhost", "127.0.0.1", "testserver"]:
    _errors.append(
        "DJANGO_ALLOWED_HOSTS must be explicitly set for production "
        "(do not use the dev default)."
    )

if _errors:
    for err in _errors:
        print(f"[PRODUCTION CONFIG ERROR] {err}", file=sys.stderr)
    raise SystemExit(
        "Production settings validation failed. "
        "Set the required environment variables before starting."
    )

# ---------------------------------------------------------------------------
# Secure cookies and proxy
# ---------------------------------------------------------------------------
SESSION_COOKIE_SECURE = env.bool("DJANGO_SESSION_COOKIE_SECURE", default=True)
CSRF_COOKIE_SECURE = env.bool("DJANGO_CSRF_COOKIE_SECURE", default=True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# ---------------------------------------------------------------------------
# TLS / HSTS — configurable via env, production-safe defaults
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True
)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)

# ---------------------------------------------------------------------------
# Password reset token exposure — always disabled in production
# ---------------------------------------------------------------------------
MEMBER_PASSWORD_RESET_EXPOSE_TOKEN = False  # noqa: F811

# ---------------------------------------------------------------------------
# Structured JSON logging — production uses single-line JSON to stdout
# ---------------------------------------------------------------------------
from apps.common.logging import STRUCTURED_LOGGING  # noqa: E402

LOGGING = STRUCTURED_LOGGING
