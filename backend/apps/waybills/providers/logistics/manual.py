"""Manual logistics provider — current behaviour (operators enter tracking manually)."""
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


class ManualLogisticsProvider(LogisticsProvider):
    """No carrier API calls — everything is entered manually by operators."""
    code = "manual"
    status = "local_verified"

    def quote(self, *, origin_country, dest_country, weight_kg, channel_code="") -> QuoteResult:
        return QuoteResult(
            provider_code=self.code,
            estimated_cost=Decimal("0"),
            detail="Manual provider: use admin panel to set shipping fees",
        )

    def create_shipment(self, *, waybill_no, recipient_name, recipient_address, weight_kg, channel_code="") -> CreateShipmentResult:
        return CreateShipmentResult(
            provider_tracking_no=f"MANUAL-{waybill_no}",
            status=ShipmentStatus.CREATED,
            detail="Manual provider: enter tracking number in admin panel",
        )

    def cancel_shipment(self, *, provider_tracking_no) -> bool:
        return True

    def get_tracking(self, *, provider_tracking_no) -> TrackingResult:
        return TrackingResult(
            provider_tracking_no=provider_tracking_no,
            status=ShipmentStatus.CREATED,
            events=[],
        )
