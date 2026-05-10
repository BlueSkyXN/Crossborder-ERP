"""Local filesystem storage provider — preserves current MEDIA_ROOT behaviour."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import BinaryIO

from django.conf import settings

from .base import StorageProvider, StorageResult


class LocalStorageProvider(StorageProvider):
    code = "local"
    status = "local_verified"

    def _resolve(self, storage_key: str) -> Path:
        path = (Path(settings.MEDIA_ROOT) / storage_key).resolve()
        media_root = Path(settings.MEDIA_ROOT).resolve()
        if not str(path).startswith(str(media_root)):
            raise ValueError("storage_key escapes MEDIA_ROOT")
        return path

    def save(self, storage_key: str, stream: BinaryIO, content_type: str = "") -> StorageResult:
        path = self._resolve(storage_key)
        path.parent.mkdir(parents=True, exist_ok=True)

        sha256 = hashlib.sha256()
        size = 0
        with path.open("wb") as f:
            while True:
                chunk = stream.read(8192)
                if not chunk:
                    break
                f.write(chunk)
                sha256.update(chunk)
                size += len(chunk)

        return StorageResult(
            storage_key=storage_key,
            size_bytes=size,
            checksum_sha256=sha256.hexdigest(),
        )

    def open(self, storage_key: str) -> BinaryIO:
        path = self._resolve(storage_key)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {storage_key}")
        return path.open("rb")  # type: ignore[return-value]

    def delete(self, storage_key: str) -> bool:
        path = self._resolve(storage_key)
        if path.is_file():
            path.unlink()
            return True
        return False

    def exists(self, storage_key: str) -> bool:
        return self._resolve(storage_key).is_file()

    def validate_configuration(self) -> dict:
        media_root = Path(settings.MEDIA_ROOT)
        return {
            "provider": self.code,
            "status": self.status,
            "media_root": str(media_root),
            "writable": media_root.exists() and media_root.is_dir(),
        }
