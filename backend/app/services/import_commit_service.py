"""Commit-Service für den Besetzungsplan-Import (Phase C).

Wendet eine bestätigte Reconciliation an: legt neue Bereiche/Ärzte an und
schreibt RotationAssignments. Schema-Auflösung kommt aus der Frontend-
Bestätigung (CommitResolutions), nicht aus erneutem Matching.

Transaktions-Reihenfolge (atomar, ein einziger db.commit() am Ende):
1. Bereiche anlegen (flush)
2. Ärzte + EmploymentPeriods anlegen (flush)
3. Plan anlegen — bei mode="new" via plan_repo.create_plan (kein interner Commit)
4. RotationAssignments bulk-anlegen (flush)
5. db.commit()
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.repositories import absence_repository as absence_repo
from app.repositories import department_repository as dept_repo
from app.repositories import doctor_repository as doctor_repo
from app.repositories import employment_period_repository as ep_repo
from app.repositories import springer_repository as springer_repo
from app.schemas.springer_assignment import SpringerAssignmentCreate

def _upsert_employment_period(
    db: Session,
    doctor_id: int,
    plan_start: date,
    percentage: int,
    created_eps_counter: list[int],
) -> None:
    existing = ep_repo.get_employment_period_covering_date(db, doctor_id, plan_start)
    if existing is None:
        ep_repo.create_employment_period(
            db,
            doctor_id,
            {"valid_from": plan_start, "valid_to": None, "employment_percentage": percentage},
        )
        created_eps_counter[0] += 1
    elif existing.employment_percentage != percentage:
        ep_repo.update_employment_period(
            db, existing.id, {"employment_percentage": percentage}
        )
        created_eps_counter[0] += 1
    # gleicher Wert → kein Schreibzugriff
from app.repositories import plan_repository as plan_repo
from app.repositories import rotation_assignment_repository as rotation_repo
from app.schemas.excel_import import CommitResolutions, ImportResult
from app.services.exceptions import PlanNotFoundError
from app.services.import_parse_service import parse_besetzungsplan
from app.services.plan_service import generate_missing_shift_slots

_PERCENT_RE = re.compile(r"^(.*?)\s*\(\d+%\)\s*$")


def _strip_percentage(raw: str) -> str:
    """Removes the '(NN%)' suffix from a raw doctor name."""
    stripped = raw.strip()
    m = _PERCENT_RE.match(stripped)
    return m.group(1).strip() if m else stripped


def _split_name_parts(raw: str) -> tuple[str, str]:
    """Returns (last_name, first_name). Strips percentage suffix first.

    'Berger, Anna (70%)' → ('Berger', 'Anna')
    'Berger Anna'        → ('Berger', 'Anna')
    'Berger Anna Maria'  → ('Berger', 'Anna Maria')
    'Berger'             → ('Berger', '')
    """
    clean = _strip_percentage(raw)
    if "," in clean:
        parts = [p.strip() for p in clean.split(",", 1)]
        return parts[0], parts[1] if len(parts) > 1 else ""
    parts = clean.split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def commit_import(db: Session, file_bytes: bytes, resolutions: CommitResolutions) -> ImportResult:
    warnings: list[str] = []

    # 1. Sheet parsen
    parsed = parse_besetzungsplan(file_bytes)
    warnings.extend(parsed.warnings)

    # 2. Bereiche auflösen
    dept_id_map: dict[str, int] = {}  # raw → department_id
    created_depts = 0
    for raw, res in resolutions.department_resolutions.items():
        if res.action == "map":
            dept_id_map[raw] = res.id
        elif res.action == "create":
            existing_dept = dept_repo.get_department_by_name(db, raw)
            if existing_dept is not None:
                dept_id_map[raw] = existing_dept.id
            else:
                dept = dept_repo.create_department(db, {"name": raw})
                dept_id_map[raw] = dept.id
                created_depts += 1
        # skip: vom Import ausgeschlossen

    # 3. Ärzte + Beschäftigungszeiträume auflösen
    target_plan = resolutions.target_plan

    # plan_start wird für EmploymentPeriod-Erstellung benötigt — VOR Doctor-Loop.
    # Bei "existing"-Mode Plan früh laden um valid_from zu ermitteln.
    existing_plan = None
    if target_plan.mode == "new":
        plan_start = target_plan.valid_from
    else:
        existing_plan = plan_repo.get_plan(db, target_plan.plan_id)
        if existing_plan is None:
            raise PlanNotFoundError(target_plan.plan_id)
        plan_start = existing_plan.valid_from

    doctor_id_map: dict[str, int] = {}  # raw → doctor_id
    created_doctors = 0
    _ep_counter = [0]  # mutable für _upsert_employment_period
    for raw, res in resolutions.doctor_resolutions.items():
        if res.action == "map":
            doctor_id_map[raw] = res.id
            if res.percentage is not None and plan_start is not None:
                _upsert_employment_period(db, res.id, plan_start, res.percentage, _ep_counter)
        elif res.action == "create":
            last_name, first_name = _split_name_parts(raw)
            doctor = doctor_repo.create_doctor(db, {"first_name": first_name, "last_name": last_name})
            created_doctors += 1
            if res.percentage is not None and plan_start is not None:
                _upsert_employment_period(db, doctor.id, plan_start, res.percentage, _ep_counter)
            doctor_id_map[raw] = doctor.id
        # skip: vom Import ausgeschlossen
    created_eps = _ep_counter[0]

    # 4. Plan anlegen oder laden.
    # plan_repo.create_plan macht keinen internen Commit — alles bleibt in einer
    # gemeinsamen Transaktion (flush only, commit erst am Ende von commit_import).
    # Shift-Slots werden nicht automatisch generiert; Phase D übernimmt das.
    if target_plan.mode == "new":
        plan = plan_repo.create_plan(
            db,
            {
                "name": target_plan.name,
                "valid_from": target_plan.valid_from,
                "valid_to": target_plan.valid_to,
            },
        )
    else:
        # Bereits in Schritt 4 geladen — kein zweiter Query.
        plan = existing_plan

    # 5. RotationAssignments — je eindeutigem (doctor, dept)-Paar genau eine.
    seen_pairs: set[tuple[int, int]] = set()
    rotation_dicts: list[dict] = []
    for row in parsed.rows:
        dept_id = dept_id_map.get(row.raw_department)
        doctor_id = doctor_id_map.get(row.raw_name)
        if dept_id is None or doctor_id is None:
            continue
        pair = (doctor_id, dept_id)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        rotation_dicts.append(
            {
                "plan_id": plan.id,
                "doctor_id": doctor_id,
                "department_id": dept_id,
                "valid_from": plan.valid_from,
                "valid_to": plan.valid_to,
                "is_einarbeitung": False,
            }
        )

    if rotation_dicts:
        rotation_repo.bulk_create_rotations(db, rotation_dicts)
    created_rotations = len(rotation_dicts)

    # 6. Code-Auflösungen: neue ShiftTypes anlegen + Schicht-Map aufbauen
    code_res = resolutions.code_resolutions
    resolved_st_ids: dict[str, int] = {}  # code → shift_type_id
    for code, res in code_res.items():
        if res.action == "shift":
            resolved_st_ids[code] = res.shift_type_id
        elif res.action == "create_shift":
            existing_st = db.query(ShiftType).filter(ShiftType.short_name == res.short_name).first()
            if existing_st:
                resolved_st_ids[code] = existing_st.id
            else:
                st = ShiftType(name=res.name, short_name=res.short_name)
                db.add(st)
                db.flush()
                db.refresh(st)
                resolved_st_ids[code] = st.id

    # 7. Zellen iterieren: Abwesenheits-Tage und Schichten sammeln
    plan_year = plan.valid_from.year
    plan_month = plan.valid_from.month

    absence_days: dict[tuple[int, str, str | None], list[date]] = defaultdict(list)
    shift_entries: list[dict] = []
    shift_seen: set[tuple[int, date]] = set()  # (shift_type_id, shift_date) für UNIQUE
    springer_entries: list[tuple[int, int, date]] = []  # (doctor_id, dept_id, shift_date)
    springer_seen: set[tuple[int, date]] = set()  # (doctor_id, shift_date) — UNIQUE per Constraint

    for row in parsed.rows:
        doctor_id = doctor_id_map.get(row.raw_name)
        if doctor_id is None:
            continue
        for day_num, code in row.cells.items():
            res_code = code_res.get(code)
            if res_code is None or res_code.action == "ignore":
                continue
            try:
                shift_date = date(plan_year, plan_month, day_num)
            except ValueError:
                warnings.append(f"Ungültiger Tag {day_num} im Monat — übersprungen")
                continue
            if res_code.action == "absence":
                notes_key = code if res_code.absence_type == "SONSTIGES" else None
                absence_days[(doctor_id, res_code.absence_type, notes_key)].append(shift_date)
            elif res_code.action in ("shift", "create_shift"):
                st_id = resolved_st_ids.get(code)
                if st_id is None:
                    continue
                key = (st_id, shift_date)
                if key in shift_seen:
                    warnings.append(
                        f"Kollision: Schicht '{code}' am {shift_date} — mehrere Ärzte, übersprungen"
                    )
                    continue
                shift_seen.add(key)
                shift_entries.append(
                    {
                        "plan_id": plan.id,
                        "shift_date": shift_date,
                        "shift_type_id": st_id,
                        "doctor_id": doctor_id,
                    }
                )
            elif res_code.action == "springer":
                key_sa = (doctor_id, shift_date)
                if key_sa in springer_seen:
                    warnings.append(
                        f"Springer-Kollision: Arzt {doctor_id} am {shift_date} — übersprungen"
                    )
                    continue
                springer_seen.add(key_sa)
                springer_entries.append((doctor_id, res_code.department_id, shift_date))

    # 8. Abwesenheits-Ranges anlegen (konsekutive Tage → ein Datensatz)
    created_absences = 0
    for (doctor_id, absence_type_str, notes_val), days in absence_days.items():
        sorted_days = sorted(set(days))
        ranges: list[tuple[date, date]] = []
        start = prev = sorted_days[0]
        for d in sorted_days[1:]:
            if (d - prev).days == 1:
                prev = d
            else:
                ranges.append((start, prev))
                start = prev = d
        ranges.append((start, prev))
        for valid_from, valid_to in ranges:
            absence_data: dict = {
                "absence_type": absence_type_str,
                "valid_from": valid_from,
                "valid_to": valid_to,
            }
            if notes_val:
                absence_data["notes"] = notes_val
            absence_repo.create_absence(db, doctor_id, absence_data)
            created_absences += 1

    # 9. Schichten bulk-anlegen
    created_shifts = 0
    if shift_entries:
        for entry in shift_entries:
            db.add(Shift(**entry))
        db.flush()
        created_shifts = len(shift_entries)

    # 9b. Fehlende Shift-Slots (doctor_id=None) für neuen Plan generieren.
    # Beim Import via plan_repo.create_plan werden keine Slots vorerzeugt (kein
    # create_plan_with_shifts). Ohne diese Slots zeigt das Popover beim Zell-Klick
    # keine offenen Schichten, obwohl Typen für den Tag konfiguriert sind.
    if target_plan.mode == "new":
        generate_missing_shift_slots(db, plan, existing_keys=shift_seen)

    # 10. Springer-Zuweisungen anlegen (upsert — überschreibt bestehende)
    created_springer = 0
    for doctor_id, dept_id, shift_date in springer_entries:
        springer_repo.upsert(
            db,
            plan.id,
            SpringerAssignmentCreate(
                shift_date=shift_date,
                doctor_id=doctor_id,
                target_department_id=dept_id,
            ),
        )
        created_springer += 1

    db.commit()

    return ImportResult(
        plan_id=plan.id,
        plan_name=plan.name,
        created_departments=created_depts,
        created_doctors=created_doctors,
        created_employment_periods=created_eps,
        created_rotations=created_rotations,
        created_absences=created_absences,
        created_shifts=created_shifts,
        created_springer_assignments=created_springer,
        warnings=warnings,
    )
