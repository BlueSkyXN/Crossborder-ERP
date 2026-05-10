"""Logistics provider abstraction (ADR-0002).

The active provider is selected via ``LOGISTICS_PROVIDER`` setting.
Default is ``"manual"`` — all tracking done manually by operators.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum


class ShipmentStatus(str, Enum):
    CREATED = "CREATED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    EXCEPTION = "EXCEPTION"


@dataclass(frozen=True)
class QuoteResult:
    provider_code: str
    estimated_cost: Decimal
    currency: str = "CNY"
    estimated_days: int = 0
    detail: str = ""


@dataclass(frozen=True)
class CreateShipmentResult:
    provider_tracking_no: str
    status: ShipmentStatus
    label_url: str = ""
    detail: str = ""


@dataclass(frozen=True)
class TrackingEvent:
    timestamp: str
    location: str = ""
    description: str = ""
    status: ShipmentStatus = ShipmentStatus.IN_TRANSIT


@dataclass(frozen=True)
class TrackingResult:
    provider_tracking_no: str
    status: ShipmentStatus
    events: list[TrackingEvent] = field(default_factory=list)


class LogisticsProvider(abc.ABC):
    """Base class for logistics providers."""

    code: str = ""
    status: str = "not_implemented"

    @abc.abstractmethod
    def quote(
        self,
        *,
        origin_country: str,
        dest_country: str,
        weight_kg: Decimal,
        channel_code: str = "",
    ) -> QuoteResult:
        """Get a shipping cost estimate."""

    @abc.abstractmethod
    def create_shipment(
        self,
        *,
        waybill_no: str,
        recipient_name: str,
        recipient_address: str,
        weight_kg: Decimal,
        channel_code: str = "",
    ) -> CreateShipmentResult:
        """Create a shipment with the carrier."""

    @abc.abstractmethod
    def cancel_shipment(self, *, provider_tracking_no: str) -> bool:
        """Cancel a shipment. Returns True if successful."""

    @abc.abstractmethod
    def get_tracking(self, *, provider_tracking_no: str) -> TrackingResult:
        """Get tracking events for a shipment."""

    def validate_configuration(self) -> dict:
        return {"provider": self.code, "status": self.status}

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": True}
