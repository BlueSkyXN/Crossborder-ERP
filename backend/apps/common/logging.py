"""Structured JSON logging configuration for production.

Usage in settings:
    from apps.common.logging import STRUCTURED_LOGGING
    LOGGING = STRUCTURED_LOGGING
"""
from __future__ import annotations

import json
import logging
import traceback
from datetime import datetime, timezone


class StructuredJsonFormatter(logging.Formatter):
    """Emit each log record as a single JSON line.

    Compatible with ELK, CloudWatch, GCP Logging, etc.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1] is not None:
            payload["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "",
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info),
            }
        # Propagate extra fields set by request_id middleware etc.
        for key in ("request_id", "user_id", "method", "path", "status_code", "duration_ms"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = val
        return json.dumps(payload, ensure_ascii=False, default=str)


STRUCTURED_LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "apps.common.logging.StructuredJsonFormatter",
        },
        "simple": {
            "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console_json": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
        "console_simple": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
    },
    "root": {
        "handlers": ["console_json"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"level": "WARNING", "propagate": True},
        "django.request": {"level": "WARNING", "propagate": True},
        "django.db.backends": {"level": "WARNING", "propagate": True},
        "apps": {"level": "INFO", "propagate": True},
    },
}
