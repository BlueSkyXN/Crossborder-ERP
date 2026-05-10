"""Disabled notification provider — silently drops all messages."""
from __future__ import annotations

from .base import NotificationMessage, NotificationProvider, SendResult


class DisabledNotificationProvider(NotificationProvider):
    code = "disabled"
    status = "disabled"

    def send(self, message: NotificationMessage) -> SendResult:
        return SendResult(success=True, detail="Notifications disabled — message dropped")

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": False, "reason": "disabled"}
