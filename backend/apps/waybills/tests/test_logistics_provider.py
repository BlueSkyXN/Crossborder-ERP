"""Tests for LogisticsProvider abstraction."""
from __future__ import annotations

from decimal import Decimal

from django.test import TestCase, override_settings

from apps.waybills.providers.logistics.base import ShipmentStatus
from apps.waybills.providers.logistics.disabled import DisabledLogisticsProvider
from apps.waybills.providers.logistics.fake import FakeLogisticsProvider
from apps.waybills.providers.logistics.manual import ManualLogisticsProvider
from apps.waybills.providers.logistics.registry import get_logistics_provider


class ManualLogisticsTests(TestCase):
    def test_quote(self):
        p = ManualLogisticsProvider()
        result = p.quote(origin_country="CN", dest_country="US", weight_kg=Decimal("2.5"))
        self.assertEqual(result.estimated_cost, Decimal("0"))

    def test_create_shipment(self):
        p = ManualLogisticsProvider()
        result = p.create_shipment(
            waybill_no="WB-001",
            recipient_name="Test",
            recipient_address="123 St",
            weight_kg=Decimal("1.0"),
        )
        self.assertEqual(result.status, ShipmentStatus.CREATED)
        self.assertIn("MANUAL", result.provider_tracking_no)

    def test_cancel(self):
        p = ManualLogisticsProvider()
        self.assertTrue(p.cancel_shipment(provider_tracking_no="MANUAL-WB-001"))


class FakeLogisticsTests(TestCase):
    def test_full_flow(self):
        p = FakeLogisticsProvider()
        create = p.create_shipment(
            waybill_no="WB-002",
            recipient_name="Bob",
            recipient_address="456 Ave",
            weight_kg=Decimal("3.0"),
        )
        self.assertEqual(create.status, ShipmentStatus.CREATED)
        tracking = p.get_tracking(provider_tracking_no=create.provider_tracking_no)
        self.assertEqual(len(tracking.events), 1)
        self.assertTrue(p.cancel_shipment(provider_tracking_no=create.provider_tracking_no))
        tracking2 = p.get_tracking(provider_tracking_no=create.provider_tracking_no)
        self.assertEqual(tracking2.status, ShipmentStatus.CANCELLED)


class DisabledLogisticsTests(TestCase):
    def test_raises(self):
        p = DisabledLogisticsProvider()
        with self.assertRaises(RuntimeError):
            p.create_shipment(
                waybill_no="x",
                recipient_name="x",
                recipient_address="x",
                weight_kg=Decimal("1"),
            )


class LogisticsRegistryTests(TestCase):
    @override_settings(LOGISTICS_PROVIDER="manual")
    def test_manual(self):
        self.assertIsInstance(get_logistics_provider(), ManualLogisticsProvider)

    @override_settings(LOGISTICS_PROVIDER="fake")
    def test_fake(self):
        self.assertIsInstance(get_logistics_provider(), FakeLogisticsProvider)

    @override_settings(LOGISTICS_PROVIDER="nope")
    def test_unknown(self):
        with self.assertRaises(ValueError):
            get_logistics_provider()
