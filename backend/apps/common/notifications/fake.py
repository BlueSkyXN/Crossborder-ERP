"""Fake notification provider for testing — records messages in memory."""
from __future__ import annotations

from .base import NotificationMessage, NotificationProvider, SendResult


class FakeNotificationProvider(NotificationProvider):
    """Records all sent messages for assertion in tests."""
    code = "fake"
    status = "local_verified"

    def __init__(self) -> None:
        self.sent: list[NotificationMessage] = []

    def send(self, message: NotificationMessage) -> SendResult:
        self.sent.append(message)
        return SendResult(
            success=True,
            provider_message_id=f"FAKE-{len(self.sent)}",
        )

    def clear(self) -> None:
        self.sent.clear()
