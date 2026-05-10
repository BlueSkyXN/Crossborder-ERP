"""Offline (wallet) payment provider — current in-process behaviour."""
from __future__ import annotations

from decimal import Decimal

from .base import (
    CreatePaymentResult,
    PaymentProvider,
    PaymentStatus,
    QueryPaymentResult,
    RefundResult,
)


class OfflinePaymentProvider(PaymentProvider):
    """Wallet deduction handled directly in domain services.

    This provider is a pass-through: the actual debit/credit logic lives
    in ``finance.services.pay_with_wallet()``. The provider simply returns
    SUCCESS to signal that the operation should proceed in-process.
    """
    code = "offline"
    status = "local_verified"

    def create_payment(
        self,
        *,
        order_no: str,
        amount: Decimal,
        currency: str = "CNY",
        description: str = "",
        return_url: str = "",
    ) -> CreatePaymentResult:
        return CreatePaymentResult(
            provider_order_id=f"OFFLINE-{order_no}",
            status=PaymentStatus.SUCCESS,
            detail="Wallet deduction handled in-process",
        )

    def query_payment(self, *, provider_order_id: str) -> QueryPaymentResult:
        return QueryPaymentResult(
            provider_order_id=provider_order_id,
            status=PaymentStatus.SUCCESS,
            detail="Offline payment — status always SUCCESS",
        )

    def refund(
        self,
        *,
        provider_order_id: str,
        refund_amount: Decimal,
        reason: str = "",
    ) -> RefundResult:
        return RefundResult(
            provider_refund_id=f"REFUND-{provider_order_id}",
            status=PaymentStatus.REFUNDED,
            refunded_amount=refund_amount,
            detail="Offline refund — handled in-process",
        )
