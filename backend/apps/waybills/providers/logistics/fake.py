"""Fake logistics provider for testing."""
from __future__ import annotations

from decimal import Decimal

from .base import (
    CreateShipmentResult,
    LogisticsProvider,
    QuoteResult,
    ShipmentStatus,
    TrackingEvent,
    TrackingResult,
)


class FakeLogisticsProvider(LogisticsProvider):
    """In-memory logistics provider for integration tests."""
    code = "fake"
    status = "local_verified"

    def __init__(self) -> None:
        self._shipments: dict[str, ShipmentStatus] = {}
        self._events: dict[str, list[TrackingEvent]] = {}

    def quote(self, *, origin_country, dest_country, weight_kg, channel_code="") -> QuoteResult:
        return QuoteResult(
            provider_code=self.code,
            estimated_cost=Decimal("25.00"),
            estimated_days=7,
            detail="Fake estimate",
        )

    def create_shipment(self, *, waybill_no, recipient_name, recipient_address, weight_kg, channel_code="") -> CreateShipmentResult:
        tracking_no = f"FAKE-{waybill_no}"
        self._shipments[tracking_no] = ShipmentStatus.CREATED
        self._events[tracking_no] = [
            TrackingEvent(
                timestamp="2025-01-01T00:00:00Z",
                location="Warehouse",
                description="Shipment created",
                status=ShipmentStatus.CREATED,
            )
        ]
        return CreateShipmentResult(
            provider_tracking_no=tracking_no,
            status=ShipmentStatus.CREATED,
            label_url="https://fake-logistics.example/label.pdf",
        )

    def cancel_shipment(self, *, provider_tracking_no) -> bool:
        if provider_tracking_no in self._shipments:
            self._shipments[provider_tracking_no] = ShipmentStatus.CANCELLED
            return True
        return False

    def get_tracking(self, *, provider_tracking_no) -> TrackingResult:
        status = self._shipments.get(provider_tracking_no, ShipmentStatus.EXCEPTION)
        events = self._events.get(provider_tracking_no, [])
        return TrackingResult(
            provider_tracking_no=provider_tracking_no,
            status=status,
            events=events,
        )
