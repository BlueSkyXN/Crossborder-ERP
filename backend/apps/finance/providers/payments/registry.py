"""Payment provider registry."""
from __future__ import annotations

from django.conf import settings

from .base import PaymentProvider
from .disabled import DisabledPaymentProvider
from .fake import FakePaymentProvider
from .offline import OfflinePaymentProvider

_PROVIDERS: dict[str, type[PaymentProvider]] = {
    "offline": OfflinePaymentProvider,
    "disabled": DisabledPaymentProvider,
    "fake": FakePaymentProvider,
}


def get_payment_provider() -> PaymentProvider:
    code = getattr(settings, "PAYMENT_PROVIDER", "offline")
    cls = _PROVIDERS.get(code)
    if cls is None:
        raise ValueError(
            f"Unknown PAYMENT_PROVIDER '{code}'. Available: {sorted(_PROVIDERS)}"
        )
    return cls()
