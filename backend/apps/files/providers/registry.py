"""Provider registry — resolves active providers from Django settings.

Usage:
    from apps.files.providers.registry import get_storage_provider, get_virus_scan_provider

    storage = get_storage_provider()
    result = storage.save(key, stream)
"""
from __future__ import annotations

import functools

from django.conf import settings

from .storage.base import StorageProvider
from .storage.disabled import DisabledStorageProvider
from .storage.fake_object import FakeObjectStorageProvider
from .storage.local import LocalStorageProvider
from .virus_scan.base import VirusScanProvider
from .virus_scan.disabled import DisabledVirusScanProvider
from .virus_scan.fake import FakeVirusScanProvider

_STORAGE_PROVIDERS: dict[str, type[StorageProvider]] = {
    "local": LocalStorageProvider,
    "disabled": DisabledStorageProvider,
    "fake_object": FakeObjectStorageProvider,
}

_VIRUS_SCAN_PROVIDERS: dict[str, type[VirusScanProvider]] = {
    "disabled": DisabledVirusScanProvider,
    "fake": FakeVirusScanProvider,
}


def get_storage_provider() -> StorageProvider:
    """Return the active storage provider configured in Django settings."""
    code = getattr(settings, "STORAGE_PROVIDER", "local")
    cls = _STORAGE_PROVIDERS.get(code)
    if cls is None:
        raise ValueError(
            f"Unknown STORAGE_PROVIDER '{code}'. "
            f"Available: {sorted(_STORAGE_PROVIDERS)}"
        )
    return cls()


def get_virus_scan_provider() -> VirusScanProvider:
    """Return the active virus scan provider configured in Django settings."""
    code = getattr(settings, "VIRUS_SCAN_PROVIDER", "disabled")
    cls = _VIRUS_SCAN_PROVIDERS.get(code)
    if cls is None:
        raise ValueError(
            f"Unknown VIRUS_SCAN_PROVIDER '{code}'. "
            f"Available: {sorted(_VIRUS_SCAN_PROVIDERS)}"
        )
    return cls()
