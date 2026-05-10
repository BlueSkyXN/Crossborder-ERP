"""Tests for NotificationProvider abstraction."""
from __future__ import annotations

from django.test import TestCase, override_settings

from apps.common.notifications.base import NotificationChannel, NotificationMessage
from apps.common.notifications.console import ConsoleNotificationProvider
from apps.common.notifications.disabled import DisabledNotificationProvider
from apps.common.notifications.fake import FakeNotificationProvider
from apps.common.notifications.registry import get_notification_provider


class DisabledNotificationTests(TestCase):
    def test_send_returns_success(self):
        p = DisabledNotificationProvider()
        msg = NotificationMessage(
            recipient_id=1,
            channel=NotificationChannel.EMAIL,
            subject="Test",
            body="Hello",
        )
        result = p.send(msg)
        self.assertTrue(result.success)


class ConsoleNotificationTests(TestCase):
    def test_send_logs(self):
        p = ConsoleNotificationProvider()
        msg = NotificationMessage(
            recipient_id=42,
            channel=NotificationChannel.SMS,
            subject="Alert",
            body="Your package has arrived",
        )
        result = p.send(msg)
        self.assertTrue(result.success)
        self.assertIn("CONSOLE", result.provider_message_id)


class FakeNotificationTests(TestCase):
    def test_records_messages(self):
        p = FakeNotificationProvider()
        msg1 = NotificationMessage(recipient_id=1, channel=NotificationChannel.EMAIL, body="Hi")
        msg2 = NotificationMessage(recipient_id=2, channel=NotificationChannel.IN_APP, body="Hey")
        p.send(msg1)
        p.send(msg2)
        self.assertEqual(len(p.sent), 2)
        self.assertEqual(p.sent[0].recipient_id, 1)

    def test_batch_send(self):
        p = FakeNotificationProvider()
        msgs = [
            NotificationMessage(recipient_id=i, channel=NotificationChannel.PUSH, body=f"msg-{i}")
            for i in range(5)
        ]
        results = p.send_batch(msgs)
        self.assertEqual(len(results), 5)
        self.assertTrue(all(r.success for r in results))
        self.assertEqual(len(p.sent), 5)

    def test_clear(self):
        p = FakeNotificationProvider()
        p.send(NotificationMessage(recipient_id=1, channel=NotificationChannel.EMAIL))
        p.clear()
        self.assertEqual(len(p.sent), 0)


class NotificationRegistryTests(TestCase):
    @override_settings(NOTIFICATION_PROVIDER="disabled")
    def test_disabled(self):
        self.assertIsInstance(get_notification_provider(), DisabledNotificationProvider)

    @override_settings(NOTIFICATION_PROVIDER="console")
    def test_console(self):
        self.assertIsInstance(get_notification_provider(), ConsoleNotificationProvider)

    @override_settings(NOTIFICATION_PROVIDER="fake")
    def test_fake(self):
        self.assertIsInstance(get_notification_provider(), FakeNotificationProvider)

    @override_settings(NOTIFICATION_PROVIDER="nope")
    def test_unknown(self):
        with self.assertRaises(ValueError):
            get_notification_provider()
