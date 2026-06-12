"""DB-Matching für den Besetzungsplan-Import (rapidfuzz, read-only)."""

from __future__ import annotations

import calendar
import re
from datetime import date

from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session

from app.models.absence import AbsenceType
from app.models.shift_type import ShiftType
from app.repositories import department_repository, doctor_repository
from app.schemas.excel_import import (
    CodeDefaultAction,
    CodeEntry,
    DepartmentMatch,
    DoctorMatch,
    EntityDefaultAction,
    ImportAnalysis,
    ImportMonth,
    MatchCandidate,
    MatchStatus,
)
from app.services.import_parse_service import ParsedSheet

FUZZY_THRESHOLD = 85

# Default-Verhalten für bekannte Codes. Alles andere → unmatched.
DEFAULT_CODE_MAP: dict[str, dict] = {
    "U":  {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.URLAUB},
    "EZ": {"action": CodeDefaultAction.ABSENCE, "absence_type": AbsenceType.ELTERNZEIT},
    "N*": {"action": CodeDefaultAction.SHIFT,   "shift_short_name": "N"},
}

# Regex: "(70%)"-Suffix vom Namen abtrennen.
_PERCENTAGE_RE = re.compile(r"^(.*?)\s*\((\d+)%\)\s*$")


def _parse_name(raw: str) -> tuple[str, int | None]:
    """Trennt 'Berger Johann (70%)' → ('Berger Johann', 70)."""
    match = _PERCENTAGE_RE.match(raw)
    if match is None:
        return raw.strip(), None
    return match.group(1).strip(), int(match.group(2))


def _match_against(
    raw: str, db_names: list[tuple[int, str]]
) -> tuple[MatchStatus, int | None, list[MatchCandidate], EntityDefaultAction]:
    """Liefert (status, matched_id, candidates, default_action) für einen Rohwert.

    Exakt (case-insensitiv) → exact; sonst rapidfuzz-Treffer → fuzzy;
    keine Treffer → new/create.
    """
    raw_lower = raw.strip().lower()

    # Exakt (case-insensitiv).
    for db_id, name in db_names:
        if name.strip().lower() == raw_lower:
            return MatchStatus.EXACT, db_id, [], EntityDefaultAction.MAP

    # Fuzzy via rapidfuzz.
    name_to_id = {name: db_id for db_id, name in db_names}
    hits = process.extract(
        raw,
        list(name_to_id.keys()),
        scorer=fuzz.token_sort_ratio,
        score_cutoff=FUZZY_THRESHOLD,
        limit=3,
    )
    if hits:
        candidates = [
            MatchCandidate(id=name_to_id[name], name=name, score=float(score))
            for name, score, _ in hits
        ]
        best_score = candidates[0].score
        default_action = EntityDefaultAction.MAP if best_score > 95 else EntityDefaultAction.CREATE
        return MatchStatus.FUZZY, candidates[0].id, candidates, default_action

    return MatchStatus.NEW, None, [], EntityDefaultAction.CREATE


def analyze_import(db: Session, parsed: ParsedSheet) -> ImportAnalysis:
    """Analysiert eine geparste Besetzungsplan-Tabelle gegen die DB (read-only)."""
    warnings = list(parsed.warnings)

    departments = department_repository.list_departments(db, include_inactive=True)
    doctors = doctor_repository.list_doctors(db, include_inactive=True)
    shift_types = db.query(ShiftType).filter(ShiftType.active.is_(True)).all()
    st_by_short = {st.short_name: st for st in shift_types}

    dept_names = [(d.id, d.name) for d in departments]
    doctor_names = [(d.id, d.name) for d in doctors]

    # --- Bereiche ---
    distinct_departments: list[str] = []
    seen_dept: set[str] = set()
    for row in parsed.rows:
        key = row.raw_department.strip().lower()
        if key not in seen_dept:
            seen_dept.add(key)
            distinct_departments.append(row.raw_department)

    department_matches: list[DepartmentMatch] = []
    for raw in distinct_departments:
        status, matched_id, candidates, default_action = _match_against(raw, dept_names)
        department_matches.append(
            DepartmentMatch(
                raw=raw,
                match_status=status,
                matched_id=matched_id,
                candidates=candidates,
                default_action=default_action,
            )
        )

    # --- Ärzte ---
    distinct_doctors: list[str] = []
    seen_doc: set[str] = set()
    for row in parsed.rows:
        key = row.raw_name.strip().lower()
        if key not in seen_doc:
            seen_doc.add(key)
            distinct_doctors.append(row.raw_name)

    doctor_matches: list[DoctorMatch] = []
    for raw in distinct_doctors:
        parsed_name, percentage = _parse_name(raw)
        status, matched_id, candidates, default_action = _match_against(
            parsed_name, doctor_names
        )
        doctor_matches.append(
            DoctorMatch(
                raw=raw,
                match_status=status,
                matched_id=matched_id,
                candidates=candidates,
                default_action=default_action,
                parsed_name=parsed_name,
                percentage=percentage,
            )
        )

    # --- Codes ---
    distinct_codes: list[str] = []
    seen_code: set[str] = set()
    for row in parsed.rows:
        for code in row.cells.values():
            if code not in seen_code:
                seen_code.add(code)
                distinct_codes.append(code)

    code_entries: list[CodeEntry] = []
    for raw in distinct_codes:
        mapping = DEFAULT_CODE_MAP.get(raw)
        if mapping is None:
            code_entries.append(
                CodeEntry(
                    raw=raw,
                    default_action=CodeDefaultAction.UNMATCHED,
                    absence_type=None,
                    shift_type_id=None,
                    shift_type_short_name=None,
                )
            )
            continue

        action = mapping["action"]
        if action == CodeDefaultAction.ABSENCE:
            code_entries.append(
                CodeEntry(
                    raw=raw,
                    default_action=CodeDefaultAction.ABSENCE,
                    absence_type=mapping["absence_type"],
                    shift_type_id=None,
                    shift_type_short_name=None,
                )
            )
        elif action == CodeDefaultAction.SHIFT:
            short_name = mapping["shift_short_name"]
            st = st_by_short.get(short_name)
            if st is None:
                warnings.append(
                    f"Code '{raw}': kein ShiftType mit Kürzel '{short_name}' gefunden."
                )
            code_entries.append(
                CodeEntry(
                    raw=raw,
                    default_action=CodeDefaultAction.SHIFT,
                    absence_type=None,
                    shift_type_id=st.id if st is not None else None,
                    shift_type_short_name=short_name,
                )
            )
        else:
            code_entries.append(
                CodeEntry(
                    raw=raw,
                    default_action=CodeDefaultAction.UNMATCHED,
                    absence_type=None,
                    shift_type_id=None,
                    shift_type_short_name=None,
                )
            )

    valid_from = date(parsed.year, parsed.month, 1)
    last_day = calendar.monthrange(parsed.year, parsed.month)[1]
    valid_to = date(parsed.year, parsed.month, last_day)

    month = ImportMonth(
        sheet_name=parsed.sheet_name,
        year=parsed.year,
        month=parsed.month,
        valid_from=valid_from,
        valid_to=valid_to,
    )

    return ImportAnalysis(
        month=month,
        departments=department_matches,
        doctors=doctor_matches,
        codes=code_entries,
        warnings=warnings,
    )
