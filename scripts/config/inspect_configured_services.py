#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse


DATABASE_ENGINES = {
    "sqlite": "django.db.backends.sqlite3",
    "postgres": "django.db.backends.postgresql",
    "postgresql": "django.db.backends.postgresql",
    "mysql": "django.db.backends.mysql",
}

DATABASE_STATUSES = {
    "django.db.backends.sqlite3": "verified_sqlite",
    "django.db.backends.postgresql": "configured_unverified",
    "django.db.backends.mysql": "configured_unverified",
}


def database_summary(database_url: str) -> dict[str, str]:
    parsed = urlparse(database_url)
    scheme = parsed.scheme.lower()
    engine = DATABASE_ENGINES.get(scheme, "unknown")
    status = DATABASE_STATUSES.get(engine, "unsupported_unverified")
    return {
        "engine": engine,
        "scheme": scheme,
        "status": status,
    }


def redis_summary(redis_url: str) -> dict[str, str | bool]:
    if not redis_url:
        return {
            "configured": False,
            "scheme": "",
            "status": "not_configured",
        }
    parsed = urlparse(redis_url)
    scheme = parsed.scheme.lower()
    status = "configured_unverified" if scheme in {"redis", "rediss"} else "unsupported_unverified"
    return {
        "configured": True,
        "scheme": scheme,
        "status": status,
    }


def celery_summary(always_eager: str, redis_url: str) -> dict[str, str | bool]:
    eager = always_eager.lower() in {"1", "true", "yes", "on"}
    redis = redis_summary(redis_url)
    if eager:
        status = "verified_eager"
    elif redis["configured"]:
        status = "configured_unverified"
    else:
        status = "not_configured"
    return {
        "always_eager": eager,
        "broker_configured": bool(redis["configured"]),
        "broker_scheme": str(redis["scheme"]),
        "status": status,
    }


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    default_database_url = f"sqlite:///{repo_root / 'backend' / 'db.sqlite3'}"
    database_url = os.environ.get("DATABASE_URL") or default_database_url
    redis_url = os.environ.get("REDIS_URL", "")
    always_eager = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "true")
    payload = {
        "database": database_summary(database_url),
        "redis": redis_summary(redis_url),
        "celery": celery_summary(always_eager, redis_url),
        "django_setup_performed": False,
        "external_connections_opened": False,
    }
    print(json.dumps(payload, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
