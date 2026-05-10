"""Disabled payment provider — rejects all operations."""
from __future__ import annotations

from decimal import Decimal

from .base import (
    CreatePaymentResult,
    PaymentProvider,
    PaymentStatus,
    QueryPaymentResult,
    RefundResult,
)


class DisabledPaymentProvider(PaymentProvider):
    code = "disabled"
    status = "disabled"

    def create_payment(self, *, order_no, amount, currency="CNY", description="", return_url="") -> CreatePaymentResult:
        raise RuntimeError("Payment provider is disabled.")

    def query_payment(self, *, provider_order_id) -> QueryPaymentResult:
        raise RuntimeError("Payment provider is disabled.")

    def refund(self, *, provider_order_id, refund_amount, reason="") -> RefundResult:
        raise RuntimeError("Payment provider is disabled.")

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": False, "reason": "disabled"}
