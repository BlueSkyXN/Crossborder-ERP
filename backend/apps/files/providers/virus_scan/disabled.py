"""Disabled virus scan — always returns SKIPPED."""
from __future__ import annotations

from typing import BinaryIO

from .base import ScanResult, ScanVerdict, VirusScanProvider


class DisabledVirusScanProvider(VirusScanProvider):
    code = "disabled"
    status = "disabled"

    def scan(self, stream: BinaryIO, filename: str = "") -> ScanResult:
        return ScanResult(verdict=ScanVerdict.SKIPPED, detail="Virus scan is disabled")

    def health_check(self) -> dict:
        return {"provider": self.code, "healthy": False, "reason": "disabled"}
