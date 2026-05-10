"""Disabled storage provider — rejects all operations."""
from __future__ import annotations

from typing import BinaryIO

from .base import StorageProvider, StorageResult


class DisabledStorageProvider(StorageProvider):
    code = "disabled"
    status = "disabled"

    def save(self, storage_key: str, stream: BinaryIO, content_type: str = "") -> StorageResult:
        raise RuntimeError("Storage is disabled. Set STORAGE_PROVIDER to enable file storage.")

    def open(self, storage_key: str) -> BinaryIO:
        raise RuntimeError("Storage is disabled.")

    def delete(self, storage_key: str) -> bool:
        raise RuntimeError("Storage is disabled.")

    def exists(self, storage_key: str) -> bool:
        return False

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": False, "reason": "disabled"}
