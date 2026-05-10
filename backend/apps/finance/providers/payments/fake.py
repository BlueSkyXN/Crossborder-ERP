"""Fake payment provider for integration testing."""
from __future__ import annotations

from decimal import Decimal

from .base import (
    CreatePaymentResult,
    PaymentProvider,
    PaymentStatus,
    QueryPaymentResult,
    RefundResult,
)


class FakePaymentProvider(PaymentProvider):
    """In-memory payment provider. Records calls for assertion in tests."""
    code = "fake"
    status = "local_verified"

    def __init__(self) -> None:
        self._payments: dict[str, PaymentStatus] = {}

    def create_payment(
        self,
        *,
        order_no: str,
        amount: Decimal,
        currency: str = "CNY",
        description: str = "",
        return_url: str = "",
    ) -> CreatePaymentResult:
        pid = f"FAKE-{order_no}"
        self._payments[pid] = PaymentStatus.SUCCESS
        return CreatePaymentResult(
            provider_order_id=pid,
            status=PaymentStatus.SUCCESS,
            redirect_url="https://fake-pay.example/checkout",
        )

    def query_payment(self, *, provider_order_id: str) -> QueryPaymentResult:
        status = self._payments.get(provider_order_id, PaymentStatus.PENDING)
        return QueryPaymentResult(
            provider_order_id=provider_order_id,
            status=status,
        )

    def refund(
        self,
        *,
        provider_order_id: str,
        refund_amount: Decimal,
        reason: str = "",
    ) -> RefundResult:
        self._payments[provider_order_id] = PaymentStatus.REFUNDED
        return RefundResult(
            provider_refund_id=f"REF-{provider_order_id}",
            status=PaymentStatus.REFUNDED,
            refunded_amount=refund_amount,
        )
