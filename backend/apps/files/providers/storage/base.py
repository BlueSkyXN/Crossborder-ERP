"""Storage provider abstraction (ADR-0002).

All file persistence goes through a StorageProvider. The active provider
is selected via the ``STORAGE_PROVIDER`` setting (default ``"local"``).
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


@dataclass(frozen=True)
class StorageResult:
    """Returned after a successful save."""
    storage_key: str
    size_bytes: int
    checksum_sha256: str


class StorageProvider(abc.ABC):
    """Base class for all storage providers."""

    code: str = ""
    status: str = "not_implemented"

    @abc.abstractmethod
    def save(self, storage_key: str, stream: BinaryIO, content_type: str = "") -> StorageResult:
        """Persist *stream* under *storage_key* and return metadata."""

    @abc.abstractmethod
    def open(self, storage_key: str) -> BinaryIO:
        """Return a readable binary stream for the stored object."""

    @abc.abstractmethod
    def delete(self, storage_key: str) -> bool:
        """Remove the object. Return True if it existed."""

    @abc.abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check whether the object exists."""

    def validate_configuration(self) -> dict:
        """Return a dict describing whether config is valid."""
        return {"provider": self.code, "status": self.status}

    def health_check(self) -> dict:
        """Return a dict describing runtime connectivity."""
        return {"provider": self.code, "healthy": True}
