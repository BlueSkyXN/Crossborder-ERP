"""Virus scan provider abstraction (ADR-0002).

Files are scanned after upload validation but before persistence.
The active provider is selected via ``VIRUS_SCAN_PROVIDER`` setting.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from enum import Enum
from typing import BinaryIO


class ScanVerdict(str, Enum):
    CLEAN = "CLEAN"
    INFECTED = "INFECTED"
    ERROR = "ERROR"
    SKIPPED = "SKIPPED"


@dataclass(frozen=True)
class ScanResult:
    verdict: ScanVerdict
    detail: str = ""


class VirusScanProvider(abc.ABC):
    """Base class for virus scan providers."""

    code: str = ""
    status: str = "not_implemented"

    @abc.abstractmethod
    def scan(self, stream: BinaryIO, filename: str = "") -> ScanResult:
        """Scan the file content and return a verdict."""

    def validate_configuration(self) -> dict:
        return {"provider": self.code, "status": self.status}

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": True}
