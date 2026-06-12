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

from sqlalchemy.orm import Session

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

    db.commit()

    return ImportResult(
        plan_id=plan.id,
        plan_name=plan.name,
        created_departments=created_depts,
        created_doctors=created_doctors,
        created_employment_periods=created_eps,
        created_rotations=created_rotations,
        warnings=warnings,
    )
