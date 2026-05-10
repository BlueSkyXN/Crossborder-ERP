"""Notification provider abstraction (ADR-0002).

The active provider is selected via ``NOTIFICATION_PROVIDER`` setting.
Default is ``"disabled"`` — no notifications sent.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import Enum


class NotificationChannel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    IN_APP = "IN_APP"
    PUSH = "PUSH"


@dataclass(frozen=True)
class NotificationMessage:
    recipient_id: int | str
    channel: NotificationChannel
    subject: str = ""
    body: str = ""
    template_code: str = ""
    template_vars: dict = None  # type: ignore[assignment]

    def __post_init__(self):
        if self.template_vars is None:
            object.__setattr__(self, "template_vars", {})


@dataclass(frozen=True)
class SendResult:
    success: bool
    provider_message_id: str = ""
    detail: str = ""


class NotificationProvider(abc.ABC):
    """Base class for notification providers."""

    code: str = ""
    status: str = "not_implemented"

    @abc.abstractmethod
    def send(self, message: NotificationMessage) -> SendResult:
        """Send a single notification."""

    def send_batch(self, messages: list[NotificationMessage]) -> list[SendResult]:
        """Send multiple notifications. Default implementation sends one by one."""
        return [self.send(m) for m in messages]

    def validate_configuration(self) -> dict:
        return {"provider": self.code, "status": self.status}

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": True}
