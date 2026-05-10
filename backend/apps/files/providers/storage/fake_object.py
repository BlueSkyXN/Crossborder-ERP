"""Fake in-memory object storage provider for testing."""
from __future__ import annotations

import hashlib
import io
from typing import BinaryIO

from .base import StorageProvider, StorageResult


class FakeObjectStorageProvider(StorageProvider):
    """In-memory storage suitable for tests and demos.

    Not persistent — data is lost when the process exits.
    """
    code = "fake_object"
    status = "local_verified"

    def __init__(self) -> None:
        self._store: dict[str, bytes] = {}

    def save(self, storage_key: str, stream: BinaryIO, content_type: str = "") -> StorageResult:
        data = stream.read()
        self._store[storage_key] = data
        return StorageResult(
            storage_key=storage_key,
            size_bytes=len(data),
            checksum_sha256=hashlib.sha256(data).hexdigest(),
        )

    def open(self, storage_key: str) -> BinaryIO:
        if storage_key not in self._store:
            raise FileNotFoundError(f"Fake object not found: {storage_key}")
        return io.BytesIO(self._store[storage_key])

    def delete(self, storage_key: str) -> bool:
        return self._store.pop(storage_key, None) is not None

    def exists(self, storage_key: str) -> bool:
        return storage_key in self._store

    def validate_configuration(self) -> dict:
        return {"provider": self.code, "status": self.status, "object_count": len(self._store)}
