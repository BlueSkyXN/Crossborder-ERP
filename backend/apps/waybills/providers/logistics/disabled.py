"""Disabled logistics provider."""
from __future__ import annotations

from .base import (
    CreateShipmentResult,
    LogisticsProvider,
    QuoteResult,
    TrackingResult,
)


class DisabledLogisticsProvider(LogisticsProvider):
    code = "disabled"
    status = "disabled"

    def quote(self, **kwargs) -> QuoteResult:
        raise RuntimeError("Logistics provider is disabled.")

    def create_shipment(self, **kwargs) -> CreateShipmentResult:
        raise RuntimeError("Logistics provider is disabled.")

    def cancel_shipment(self, **kwargs) -> bool:
        raise RuntimeError("Logistics provider is disabled.")

    def get_tracking(self, **kwargs) -> TrackingResult:
        raise RuntimeError("Logistics provider is disabled.")

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": False, "reason": "disabled"}
