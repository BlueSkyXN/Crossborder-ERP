import pytest

from apps.common.csv_exports import safe_csv_cell, safe_csv_row


@pytest.mark.parametrize("value", ["=1+1", "+SUM(1,1)", "-10+cmd", "@HYPERLINK", " =1+1", "\t=1+1"])
def test_safe_csv_cell_prefixes_formula_like_values(value):
    assert safe_csv_cell(value) == f"'{value}"


def test_safe_csv_cell_keeps_plain_values_and_normalizes_none():
    assert safe_csv_cell("normal text") == "normal text"
    assert safe_csv_cell(123) == "123"
    assert safe_csv_cell(None) == ""


def test_safe_csv_row_sanitizes_all_cells():
    assert safe_csv_row({"name": "=cmd", "count": 2}) == {"name": "'=cmd", "count": "2"}
