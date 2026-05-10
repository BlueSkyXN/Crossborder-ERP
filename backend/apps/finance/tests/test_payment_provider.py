"""Tests for PaymentProvider abstraction."""
from __future__ import annotations

from decimal import Decimal

from django.test import TestCase, override_settings

from apps.finance.providers.payments.base import PaymentStatus
from apps.finance.providers.payments.disabled import DisabledPaymentProvider
from apps.finance.providers.payments.fake import FakePaymentProvider
from apps.finance.providers.payments.offline import OfflinePaymentProvider
from apps.finance.providers.payments.registry import get_payment_provider


class OfflinePaymentTests(TestCase):
    def test_create_payment(self):
        p = OfflinePaymentProvider()
        result = p.create_payment(order_no="PAY-001", amount=Decimal("100.00"))
        self.assertEqual(result.status, PaymentStatus.SUCCESS)
        self.assertIn("OFFLINE", result.provider_order_id)

    def test_query_payment(self):
        p = OfflinePaymentProvider()
        result = p.query_payment(provider_order_id="OFFLINE-PAY-001")
        self.assertEqual(result.status, PaymentStatus.SUCCESS)

    def test_refund(self):
        p = OfflinePaymentProvider()
        result = p.refund(provider_order_id="OFFLINE-PAY-001", refund_amount=Decimal("50.00"))
        self.assertEqual(result.status, PaymentStatus.REFUNDED)
        self.assertEqual(result.refunded_amount, Decimal("50.00"))


class FakePaymentTests(TestCase):
    def test_flow(self):
        p = FakePaymentProvider()
        create = p.create_payment(order_no="T-001", amount=Decimal("200.00"))
        self.assertEqual(create.status, PaymentStatus.SUCCESS)
        query = p.query_payment(provider_order_id=create.provider_order_id)
        self.assertEqual(query.status, PaymentStatus.SUCCESS)
        refund = p.refund(provider_order_id=create.provider_order_id, refund_amount=Decimal("200.00"))
        self.assertEqual(refund.status, PaymentStatus.REFUNDED)


class DisabledPaymentTests(TestCase):
    def test_raises(self):
        p = DisabledPaymentProvider()
        with self.assertRaises(RuntimeError):
            p.create_payment(order_no="x", amount=Decimal("1"))


class PaymentRegistryTests(TestCase):
    @override_settings(PAYMENT_PROVIDER="offline")
    def test_offline(self):
        self.assertIsInstance(get_payment_provider(), OfflinePaymentProvider)

    @override_settings(PAYMENT_PROVIDER="fake")
    def test_fake(self):
        self.assertIsInstance(get_payment_provider(), FakePaymentProvider)

    @override_settings(PAYMENT_PROVIDER="disabled")
    def test_disabled(self):
        self.assertIsInstance(get_payment_provider(), DisabledPaymentProvider)

    @override_settings(PAYMENT_PROVIDER="nope")
    def test_unknown(self):
        with self.assertRaises(ValueError):
            get_payment_provider()
