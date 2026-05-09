from __future__ import annotations

from collections.abc import Mapping
from typing import Any


CSV_FORMULA_PREFIXES = ("=", "+", "-", "@")
CSV_CONTROL_PREFIXES = ("\t", "\r", "\n")


def safe_csv_cell(value: Any) -> str:
    if value is None:
        return ""

    text = str(value)
    stripped = text.lstrip()
    if text.startswith(CSV_CONTROL_PREFIXES) or stripped.startswith(CSV_FORMULA_PREFIXES):
        return f"'{text}"
    return text


def safe_csv_row(row: Mapping[str, Any]) -> dict[str, str]:
    return {key: safe_csv_cell(value) for key, value in row.items()}
