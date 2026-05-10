"""Payment provider abstraction (ADR-0002).

The active provider is selected via ``PAYMENT_PROVIDER`` setting.
Default is ``"offline"`` — wallet-based payment handled in-process.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True)
class CreatePaymentResult:
    provider_order_id: str
    status: PaymentStatus
    redirect_url: str = ""
    detail: str = ""


@dataclass(frozen=True)
class QueryPaymentResult:
    provider_order_id: str
    status: PaymentStatus
    paid_amount: Decimal = Decimal("0")
    detail: str = ""


@dataclass(frozen=True)
class RefundResult:
    provider_refund_id: str
    status: PaymentStatus
    refunded_amount: Decimal = Decimal("0")
    detail: str = ""


class PaymentProvider(abc.ABC):
    """Base class for payment providers."""

    code: str = ""
    status: str = "not_implemented"

    @abc.abstractmethod
    def create_payment(
        self,
        *,
        order_no: str,
        amount: Decimal,
        currency: str = "CNY",
        description: str = "",
        return_url: str = "",
    ) -> CreatePaymentResult:
        """Initiate a payment."""

    @abc.abstractmethod
    def query_payment(self, *, provider_order_id: str) -> QueryPaymentResult:
        """Query the status of a payment."""

    @abc.abstractmethod
    def refund(
        self,
        *,
        provider_order_id: str,
        refund_amount: Decimal,
        reason: str = "",
    ) -> RefundResult:
        """Initiate a refund."""

    def validate_configuration(self) -> dict:
        return {"provider": self.code, "status": self.status}

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": True}
