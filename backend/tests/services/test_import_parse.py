"""Unit-Tests für import_parse_service (pure, kein DB)."""

from pathlib import Path

import pytest

from app.services.import_parse_service import ParsedSheet, parse_besetzungsplan

_FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "Besetzungsplan_07_2026_V5.xlsx"


@pytest.fixture(scope="module")
def parsed() -> ParsedSheet:
    return parse_besetzungsplan(_FIXTURE.read_bytes())


def test_month_and_year(parsed: ParsedSheet) -> None:
    assert parsed.month == 7
    assert parsed.year == 2026
    assert parsed.sheet_name == "Juli 2026"


def test_row_count_and_xxxx_warning(parsed: ParsedSheet) -> None:
    # 36 Col-B-Einträge, 1 davon ist "XXXX" → 35 echte Zeilen + 1 Warning.
    assert len(parsed.rows) == 35
    assert len(parsed.warnings) == 1
    assert "XXXX" in parsed.warnings[0]


def test_day_to_code_mapping(parsed: ParsedSheet) -> None:
    sproetge = next(r for r in parsed.rows if r.raw_name.endswith(", Tim"))
    for day in range(13, 18):
        assert sproetge.cells[day] == "U"
    # Außerhalb des Urlaubsfensters keine Codes auf diesen Tagen.
    assert 1 not in sproetge.cells


def test_doctor_name_with_percentage_kept_raw(parsed: ParsedSheet) -> None:
    # Parse-Service lässt den Rohnamen unangetastet; FTE-Parsing passiert im Match-Service.
    raw_names = [r.raw_name for r in parsed.rows]
    assert "Berger Johann (70%)" in raw_names
    assert "von der Gablentz, Janina (67%)" in raw_names
