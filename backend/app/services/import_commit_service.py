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
from app.repositories import plan_repository as plan_repo
from app.repositories import rotation_assignment_repository as rotation_repo
from app.schemas.excel_import import CommitResolutions, ImportResult
from app.services.exceptions import PlanNotFoundError
from app.services.import_parse_service import parse_besetzungsplan

_PERCENT_RE = re.compile(r"^(.*?)\s*\(\d+%\)\s*$")


def _parse_name(raw: str) -> str:
    """Entfernt das '(NN%)'-Suffix aus einem Arzt-Namen."""
    stripped = raw.strip()
    m = _PERCENT_RE.match(stripped)
    return m.group(1).strip() if m else stripped


def commit_import(db: Session, file_bytes: bytes, resolutions: CommitResolutions) -> ImportResult:
    warnings: list[str] = []

    # 1. Sheet parsen
    parsed = parse_besetzungsplan(file_bytes)
    warnings.extend(parsed.warnings)

    # 2. raw → geparster Name (für neu angelegte Ärzte)
    raw_to_parsed_name: dict[str, str] = {
        row.raw_name: _parse_name(row.raw_name) for row in parsed.rows
    }

    # 3. Bereiche auflösen
    dept_id_map: dict[str, int] = {}  # raw → department_id
    created_depts = 0
    for raw, res in resolutions.department_resolutions.items():
        if res.action == "map":
            dept_id_map[raw] = res.id
        elif res.action == "create":
            dept = dept_repo.create_department(db, {"name": raw})
            dept_id_map[raw] = dept.id
            created_depts += 1
        # skip: vom Import ausgeschlossen

    # 4. Ärzte + Beschäftigungszeiträume auflösen
    target_plan = resolutions.target_plan
    plan_start = target_plan.valid_from if target_plan.mode == "new" else None

    doctor_id_map: dict[str, int] = {}  # raw → doctor_id
    created_doctors = 0
    created_eps = 0
    for raw, res in resolutions.doctor_resolutions.items():
        if res.action == "map":
            doctor_id_map[raw] = res.id
        elif res.action == "create":
            parsed_name = raw_to_parsed_name.get(raw, _parse_name(raw))
            doctor = doctor_repo.create_doctor(db, {"name": parsed_name})
            created_doctors += 1
            if res.percentage is not None and plan_start is not None:
                ep_repo.create_employment_period(
                    db,
                    doctor.id,
                    {
                        "valid_from": plan_start,
                        "valid_to": None,
                        "employment_percentage": res.percentage,
                    },
                )
                created_eps += 1
            doctor_id_map[raw] = doctor.id
        # skip: vom Import ausgeschlossen

    # 5. Plan anlegen oder laden.
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
        plan = plan_repo.get_plan(db, target_plan.plan_id)
        if plan is None:
            raise PlanNotFoundError(target_plan.plan_id)

    # 6. RotationAssignments — je eindeutigem (doctor, dept)-Paar genau eine.
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

    # 7. Code-Auflösungen: neue ShiftTypes anlegen + Schicht-Map aufbauen
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

    # 8. Zellen iterieren: Abwesenheits-Tage und Schichten sammeln
    plan_year = plan.valid_from.year
    plan_month = plan.valid_from.month

    absence_days: dict[tuple[int, str], list[date]] = defaultdict(list)
    shift_entries: list[dict] = []
    shift_seen: set[tuple[int, date]] = set()  # (shift_type_id, shift_date) für UNIQUE

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
                absence_days[(doctor_id, res_code.absence_type)].append(shift_date)
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

    # 9. Abwesenheits-Ranges anlegen (konsekutive Tage → ein Datensatz)
    created_absences = 0
    for (doctor_id, absence_type_str), days in absence_days.items():
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
            absence_repo.create_absence(
                db,
                doctor_id,
                {
                    "absence_type": absence_type_str,
                    "valid_from": valid_from,
                    "valid_to": valid_to,
                },
            )
            created_absences += 1

    # 10. Schichten bulk-anlegen
    created_shifts = 0
    if shift_entries:
        for entry in shift_entries:
            db.add(Shift(**entry))
        db.flush()
        created_shifts = len(shift_entries)

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
        warnings=warnings,
    )
