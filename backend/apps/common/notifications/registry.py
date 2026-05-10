"""Notification provider registry."""
from __future__ import annotations

from django.conf import settings

from .base import NotificationProvider
from .console import ConsoleNotificationProvider
from .disabled import DisabledNotificationProvider
from .fake import FakeNotificationProvider

_PROVIDERS: dict[str, type[NotificationProvider]] = {
    "disabled": DisabledNotificationProvider,
    "console": ConsoleNotificationProvider,
    "fake": FakeNotificationProvider,
}


def get_notification_provider() -> NotificationProvider:
    code = getattr(settings, "NOTIFICATION_PROVIDER", "disabled")
    cls = _PROVIDERS.get(code)
    if cls is None:
        raise ValueError(
            f"Unknown NOTIFICATION_PROVIDER '{code}'. Available: {sorted(_PROVIDERS)}"
        )
    return cls()
