"""Fake virus scan for testing — configurable verdict."""
from __future__ import annotations

from typing import BinaryIO

from .base import ScanResult, ScanVerdict, VirusScanProvider


class FakeVirusScanProvider(VirusScanProvider):
    """Returns CLEAN by default; can be configured to return INFECTED for testing."""
    code = "fake"
    status = "local_verified"

    def __init__(self, *, default_verdict: ScanVerdict = ScanVerdict.CLEAN) -> None:
        self._default_verdict = default_verdict
        self._next_verdict: ScanVerdict | None = None

    def set_next_verdict(self, verdict: ScanVerdict) -> None:
        """Override the verdict for the next scan call (test helper)."""
        self._next_verdict = verdict

    def scan(self, stream: BinaryIO, filename: str = "") -> ScanResult:
        verdict = self._next_verdict or self._default_verdict
        self._next_verdict = None
        return ScanResult(
            verdict=verdict,
            detail=f"Fake scan: {verdict.value} for {filename or 'unknown'}",
        )
