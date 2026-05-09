from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import environ


SQLITE_ENGINE = "django.db.backends.sqlite3"
POSTGRES_ENGINE = "django.db.backends.postgresql"
MYSQL_ENGINE = "django.db.backends.mysql"

DATABASE_ENGINE_STATUSES = {
    SQLITE_ENGINE: "verified_sqlite",
    POSTGRES_ENGINE: "configured_unverified",
    MYSQL_ENGINE: "configured_unverified",
}


def build_database_config(database_url: str | None, default_sqlite_path: Path) -> dict:
    url = database_url or f"sqlite:///{default_sqlite_path}"
    return environ.Env.db_url_config(url)


def describe_database_config(config: dict) -> dict[str, str]:
    engine = str(config.get("ENGINE", ""))
    return {
        "engine": engine or "unknown",
        "status": DATABASE_ENGINE_STATUSES.get(engine, "unsupported_unverified"),
    }


def describe_redis_url(redis_url: str | None) -> dict[str, str | bool]:
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


def describe_celery_config(always_eager: bool, broker_url: str | None) -> dict[str, str | bool]:
    broker = describe_redis_url(broker_url)
    if always_eager:
        status = "verified_eager"
    elif broker["configured"]:
        status = "configured_unverified"
    else:
        status = "not_configured"

    return {
        "always_eager": always_eager,
        "broker_configured": bool(broker["configured"]),
        "broker_scheme": str(broker["scheme"]),
        "status": status,
    }
