"""Console notification provider — prints to stdout/logger for development."""
from __future__ import annotations

import logging

from .base import NotificationMessage, NotificationProvider, SendResult

logger = logging.getLogger(__name__)


class ConsoleNotificationProvider(NotificationProvider):
    """Logs notification messages to stdout. Useful for local development."""
    code = "console"
    status = "local_verified"

    def send(self, message: NotificationMessage) -> SendResult:
        logger.info(
            "[NOTIFICATION] channel=%s recipient=%s subject=%s body=%s",
            message.channel.value,
            message.recipient_id,
            message.subject,
            message.body[:200],
        )
        return SendResult(
            success=True,
            provider_message_id=f"CONSOLE-{message.recipient_id}-{message.channel.value}",
            detail="Logged to console",
        )
