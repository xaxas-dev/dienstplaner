"""Tests für import_match_service (DB-Matching mit rapidfuzz)."""

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor
from app.models.shift_type import ShiftType
from app.schemas.excel_import import CodeDefaultAction, MatchStatus
from app.services.import_match_service import analyze_import, _match_against
from app.services.import_parse_service import ParsedRow, ParsedSheet


def _sheet(rows: list[ParsedRow]) -> ParsedSheet:
    return ParsedSheet(sheet_name="Juli 2026", year=2026, month=7, rows=rows)


def test_department_exact_match(db: Session) -> None:
    db.add(Department(name="SU"))
    db.commit()

    sheet = _sheet([ParsedRow(raw_department="SU", raw_name="Mustermann, Max", cells={})])
    analysis = analyze_import(db, sheet)

    dept = next(d for d in analysis.departments if d.raw == "SU")
    assert dept.match_status == MatchStatus.EXACT
    assert dept.matched_id is not None
    assert dept.candidates == []


def test_department_fuzzy_match(db: Session) -> None:
    # Tippfehler in DB ("Forschungg"), korrekter Wert im Excel ("Forschung").
    dept_row = Department(name="Forschungg")
    db.add(dept_row)
    db.commit()

    sheet = _sheet([ParsedRow(raw_department="Forschung", raw_name="Mustermann, Max", cells={})])
    analysis = analyze_import(db, sheet)

    dept = next(d for d in analysis.departments if d.raw == "Forschung")
    assert dept.match_status == MatchStatus.FUZZY
    assert dept.candidates
    assert dept.candidates[0].score >= 85
    assert dept.candidates[0].id == dept_row.id


def test_department_new(db: Session) -> None:
    # Keine Abteilung "511" in der DB.
    sheet = _sheet([ParsedRow(raw_department="511", raw_name="Mustermann, Max", cells={})])
    analysis = analyze_import(db, sheet)

    dept = next(d for d in analysis.departments if d.raw == "511")
    assert dept.match_status == MatchStatus.NEW
    assert dept.matched_id is None
    assert dept.default_action == "create"


def test_code_defaults(db: Session) -> None:
    db.add(ShiftType(name="Nacht", short_name="N", display_order=1, applies_on_weekend=True))
    db.commit()

    sheet = _sheet(
        [
            ParsedRow(
                raw_department="SU",
                raw_name="Mustermann, Max",
                cells={1: "U", 2: "N*", 3: "EA"},
            )
        ]
    )
    analysis = analyze_import(db, sheet)
    codes = {c.raw: c for c in analysis.codes}

    assert codes["U"].default_action == CodeDefaultAction.ABSENCE
    assert codes["U"].absence_type == "URLAUB"

    assert codes["N*"].default_action == CodeDefaultAction.SHIFT
    assert codes["N*"].shift_type_short_name == "N"
    assert codes["N*"].shift_type_id is not None

    assert codes["EA"].default_action == CodeDefaultAction.ABSENCE
    assert codes["EA"].absence_type == "EINARBEITUNG"


def test_code_shift_warning_when_no_shift_type(db: Session) -> None:
    # Kein ShiftType "N" → Warning + shift_type_id None.
    sheet = _sheet(
        [ParsedRow(raw_department="SU", raw_name="Mustermann, Max", cells={1: "N*"})]
    )
    analysis = analyze_import(db, sheet)

    code = next(c for c in analysis.codes if c.raw == "N*")
    assert code.default_action == CodeDefaultAction.SHIFT
    assert code.shift_type_id is None
    assert any("N" in w for w in analysis.warnings)


def test_doctor_name_parsing(db: Session) -> None:
    sheet = _sheet(
        [
            ParsedRow(
                raw_department="Forschung",
                raw_name="von der Gablentz, Janina (67%)",
                cells={},
            )
        ]
    )
    analysis = analyze_import(db, sheet)

    doc = analysis.doctors[0]
    assert doc.parsed_name == "von der Gablentz, Janina"
    assert doc.percentage == 67
    assert doc.match_status == MatchStatus.NEW


def test_doctor_exact_match_uses_parsed_name(db: Session) -> None:
    doctor = Doctor(name="Berger Johann")
    db.add(doctor)
    db.commit()

    sheet = _sheet(
        [ParsedRow(raw_department="SU", raw_name="Berger Johann (70%)", cells={})]
    )
    analysis = analyze_import(db, sheet)

    doc = analysis.doctors[0]
    assert doc.parsed_name == "Berger Johann"
    assert doc.percentage == 70
    assert doc.match_status == MatchStatus.EXACT
    assert doc.matched_id == doctor.id


def test_department_numeric_prefix_stripped(db: Session) -> None:
    """'511/LBEST' soll 'LBEST' in der DB exact matchen."""
    db.add(Department(name="LBEST"))
    db.commit()

    sheet = _sheet([ParsedRow(raw_department="511/LBEST", raw_name="Mustermann, Max", cells={})])
    analysis = analyze_import(db, sheet)

    dept = next(d for d in analysis.departments if d.raw == "511/LBEST")
    assert dept.match_status == MatchStatus.EXACT
    assert dept.matched_id is not None
def test_match_against_short_name_exact():
    """Short name in db_names list -> exact match."""
    db_names = [(7, "Neurologie Allgemein"), (7, "NEU")]
    status, matched_id, _, _ = _match_against("NEU", db_names)
    assert status == MatchStatus.EXACT
    assert matched_id == 7


def test_match_against_without_short_name_returns_new():
    """Without short name entry, short-name query yields NEW."""
    db_names = [(7, "Neurologie Allgemein")]
    status, matched_id, _, _ = _match_against("NEU", db_names)
    assert status == MatchStatus.NEW
    assert matched_id is None
