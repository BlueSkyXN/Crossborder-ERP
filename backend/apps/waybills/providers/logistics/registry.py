"""Logistics provider registry."""
from __future__ import annotations

from django.conf import settings

from .base import LogisticsProvider
from .disabled import DisabledLogisticsProvider
from .fake import FakeLogisticsProvider
from .manual import ManualLogisticsProvider

_PROVIDERS: dict[str, type[LogisticsProvider]] = {
    "manual": ManualLogisticsProvider,
    "disabled": DisabledLogisticsProvider,
    "fake": FakeLogisticsProvider,
}


def get_logistics_provider() -> LogisticsProvider:
    code = getattr(settings, "LOGISTICS_PROVIDER", "manual")
    cls = _PROVIDERS.get(code)
    if cls is None:
        raise ValueError(
            f"Unknown LOGISTICS_PROVIDER '{code}'. Available: {sorted(_PROVIDERS)}"
        )
    return cls()
