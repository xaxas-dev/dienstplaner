from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session, selectinload

from app.models.plan import Plan, PlanStatus
from app.models.rotation_assignment import RotationAssignment
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.repositories import plan_repository as plan_repo
from app.repositories import plan_version_repository as version_repo
from app.repositories import rotation_assignment_repository as rotation_repo
from app.repositories import shift_repository as shift_repo
from app.repositories import shift_type_repository as shift_type_repo
from app.services.exceptions import (
    PlanNotFoundError,
    PlanValidationError,
    RotationNotFoundError,
    RotationValidationError,
)
from app.services.holiday_service import get_holiday_dates_for_period

# T1 wird per short_name identifiziert (ADR dokumentiert in decisions.md)
_T1_SHORT_NAME = "T1"


# ---------------------------------------------------------------------------
# Reine Hilfsfunktionen (testbar ohne DB)
# ---------------------------------------------------------------------------


def _generate_shift_dicts(
    plan_id: int,
    valid_from: date,
    valid_to: date,
    shift_types: list[ShiftType],
    holiday_dates: set[date] | None = None,
) -> list[dict[str, Any]]:
    """Erzeugt Shift-Dicts für jeden Tag im Zeitraum.
    isoweekday(): 1-5 = Werktag, 6-7 = Wochenende.
    Feiertage (holiday_dates) werden wie Wochenendtage behandelt: applies_on_weekend-Shifts.
    """
    _holidays = holiday_dates or set()
    result: list[dict[str, Any]] = []
    current = valid_from
    while current <= valid_to:
        is_weekend_or_holiday = current.isoweekday() >= 6 or current in _holidays
        for st in shift_types:
            if is_weekend_or_holiday and st.applies_on_weekend:
                result.append(
                    {
                        "plan_id": plan_id,
                        "shift_date": current,
                        "shift_type_id": st.id,
                        "doctor_id": None,
                        "is_pinned": False,
                    }
                )
            elif not is_weekend_or_holiday and st.applies_on_weekdays:
                result.append(
                    {
                        "plan_id": plan_id,
                        "shift_date": current,
                        "shift_type_id": st.id,
                        "doctor_id": None,
                        "is_pinned": False,
                    }
                )
        current += timedelta(days=1)
    return result


def _apply_rotation_offset(
    old_from: date,
    old_to: date,
    offset: timedelta,
    plan_valid_from: date,
    plan_valid_to: date,
) -> tuple[date, date] | None:
    """Berechnet neue Rotationsdaten mit Offset und Clipping.
    Gibt None zurück wenn die Rotation komplett außerhalb liegt.
    """
    new_from = old_from + offset
    new_to = old_to + offset

    if new_to < plan_valid_from or new_from > plan_valid_to:
        return None

    clipped_from = max(new_from, plan_valid_from)
    clipped_to = min(new_to, plan_valid_to)
    return clipped_from, clipped_to


# ---------------------------------------------------------------------------
# Validierungen
# ---------------------------------------------------------------------------


def validate_plan_data(data: dict) -> None:
    name = data.get("name", "")
    if not name or not str(name).strip():
        raise PlanValidationError("Plan-Name darf nicht leer sein")
    valid_from = data.get("valid_from")
    valid_to = data.get("valid_to")
    if valid_from is not None and valid_to is not None and valid_from > valid_to:
        raise PlanValidationError("valid_from muss vor oder gleich valid_to liegen")


def validate_rotation_dates(rotation_data: dict, plan: Plan) -> None:
    valid_from = rotation_data.get("valid_from")
    valid_to = rotation_data.get("valid_to")
    if valid_from is not None and valid_from < plan.valid_from:
        raise RotationValidationError(
            f"Rotations-Beginn {valid_from} liegt vor Plan-Beginn {plan.valid_from}"
        )
    if valid_to is not None and valid_to > plan.valid_to:
        raise RotationValidationError(
            f"Rotations-Ende {valid_to} liegt nach Plan-Ende {plan.valid_to}"
        )
    if valid_from is not None and valid_to is not None and valid_from > valid_to:
        raise RotationValidationError("Rotations-Beginn muss vor oder gleich Rotations-Ende liegen")


# ---------------------------------------------------------------------------
# DB-Operationen
# ---------------------------------------------------------------------------


def _get_applicable_shift_types(db: Session, shift_type_ids: list[int] | None) -> list[ShiftType]:
    if shift_type_ids:
        types = [shift_type_repo.get_shift_type(db, sid) for sid in shift_type_ids]
        return [t for t in types if t is not None and t.active]
    # Default: alle aktiven außer T1
    all_active = shift_type_repo.list_shift_types(db, include_inactive=False)
    return [t for t in all_active if t.short_name != _T1_SHORT_NAME]


def create_plan_with_shifts(
    db: Session, data: dict, shift_type_ids: list[int] | None = None
) -> Plan:
    validate_plan_data(data)
    shift_types = _get_applicable_shift_types(db, shift_type_ids)
    if not shift_types:
        raise PlanValidationError("Keine aktiven Schichttypen für die Schichtgenerierung verfügbar")

    plan = plan_repo.create_plan(db, data)
    holiday_dates = get_holiday_dates_for_period(db, plan.valid_from, plan.valid_to)
    shift_dicts = _generate_shift_dicts(
        plan.id, plan.valid_from, plan.valid_to, shift_types, holiday_dates
    )
    shift_repo.bulk_create_shifts(db, shift_dicts)

    db.commit()
    return plan_repo.get_plan(db, plan.id)  # type: ignore[return-value]


def generate_missing_shift_slots(
    db: Session,
    plan: Plan,
    existing_keys: set[tuple[int, date]] | None = None,
) -> int:
    """Erzeugt fehlende Shift-Slots mit doctor_id=None für einen Plan.

    Überspringt (shift_type_id, shift_date)-Paare, die bereits in
    existing_keys enthalten sind (z.B. aus einem Import-Schritt gesetzt).
    Gibt Anzahl neu erstellter Slots zurück.
    """
    shift_types = _get_applicable_shift_types(db, None)
    if not shift_types:
        return 0
    holiday_dates = get_holiday_dates_for_period(db, plan.valid_from, plan.valid_to)
    all_slots = _generate_shift_dicts(plan.id, plan.valid_from, plan.valid_to, shift_types, holiday_dates)
    count = 0
    for slot in all_slots:
        key = (slot["shift_type_id"], slot["shift_date"])
        if existing_keys and key in existing_keys:
            continue
        db.add(Shift(**slot))
        count += 1
    if count:
        db.flush()
    return count


def clone_plan(db: Session, source_plan_id: int, new_plan_data: dict) -> tuple[Plan, int, int]:
    """Klont einen Plan. Gibt (neuer Plan, kopierte Rotationen, übersprungene) zurück."""
    source = plan_repo.get_plan(db, source_plan_id)
    if source is None:
        raise PlanNotFoundError(source_plan_id)

    validate_plan_data(new_plan_data)

    # Neuen Plan anlegen
    new_plan = plan_repo.create_plan(db, new_plan_data)

    # Schichten neu generieren (Default: ohne T1)
    shift_types = _get_applicable_shift_types(db, None)
    if shift_types:
        holiday_dates = get_holiday_dates_for_period(db, new_plan.valid_from, new_plan.valid_to)
        shift_dicts = _generate_shift_dicts(
            new_plan.id, new_plan.valid_from, new_plan.valid_to, shift_types, holiday_dates
        )
        shift_repo.bulk_create_shifts(db, shift_dicts)

    # Rotationen mit Offset kopieren
    offset = new_plan.valid_from - source.valid_from
    source_rotations = rotation_repo.list_rotations_for_plan(db, source_plan_id)

    copied = 0
    skipped = 0
    rotation_dicts: list[dict] = []

    for ra in source_rotations:
        result = _apply_rotation_offset(
            ra.valid_from, ra.valid_to, offset, new_plan.valid_from, new_plan.valid_to
        )
        if result is None:
            skipped += 1
            continue
        new_from, new_to = result
        rotation_dicts.append(
            {
                "plan_id": new_plan.id,
                "doctor_id": ra.doctor_id,
                "department_id": ra.department_id,
                "valid_from": new_from,
                "valid_to": new_to,
                "notes": ra.notes,
            }
        )
        copied += 1

    if rotation_dicts:
        rotation_repo.bulk_create_rotations(db, rotation_dicts)

    db.commit()
    refreshed = plan_repo.get_plan(db, new_plan.id)
    return refreshed, copied, skipped  # type: ignore[return-value]


def _build_snapshot_json(
    plan: Plan, shifts: list[Shift], rotations: list[RotationAssignment]
) -> dict:
    """Serialisiert Plan-Daten als JSON-fähiges Dict (Dates als ISO-Strings)."""
    from app.schemas.plan import PlanResponse
    from app.schemas.rotation_assignment import RotationAssignmentWithDetails
    from app.schemas.shift import ShiftWithDetails

    return {
        "plan": PlanResponse.model_validate(plan).model_dump(mode="json"),
        "shifts": [ShiftWithDetails.model_validate(s).model_dump(mode="json") for s in shifts],
        "rotation_assignments": [
            RotationAssignmentWithDetails.model_validate(r).model_dump(mode="json")
            for r in rotations
        ],
        "snapshot_date": date.today().isoformat(),
    }


def create_version_snapshot(db: Session, plan_id: int, comment: str | None = None) -> object:
    plan = (
        db.query(Plan)
        .options(
            selectinload(Plan.shifts).selectinload(Shift.shift_type),
            selectinload(Plan.shifts).selectinload(Shift.doctor),
            selectinload(Plan.rotation_assignments).selectinload(RotationAssignment.doctor),
            selectinload(Plan.rotation_assignments).selectinload(RotationAssignment.department),
        )
        .filter(Plan.id == plan_id)
        .first()
    )
    if plan is None:
        raise PlanNotFoundError(plan_id)

    snapshot = _build_snapshot_json(plan, plan.shifts, plan.rotation_assignments)
    pv = version_repo.create_version(db, plan_id, snapshot, comment=comment)
    db.commit()
    db.refresh(pv)
    return pv


def update_plan_status(db: Session, plan_id: int, data: dict) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    old_status = plan.status
    new_status = data.get("status")

    plan_repo.update_plan(db, plan_id, data)

    if new_status == PlanStatus.RELEASED and old_status != PlanStatus.RELEASED:
        create_version_snapshot(db, plan_id, comment="Statuswechsel zu RELEASED")
    else:
        db.commit()

    return plan_repo.get_plan(db, plan_id)  # type: ignore[return-value]


def create_rotation_with_validation(db: Session, plan_id: int, data: dict) -> RotationAssignment:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    validate_rotation_dates(data, plan)
    ra = rotation_repo.create_rotation(db, plan_id, data)
    db.commit()
    db.refresh(ra)
    return ra


def update_rotation_with_validation(
    db: Session, rotation_id: int, data: dict
) -> RotationAssignment:
    ra = rotation_repo.get_rotation(db, rotation_id)
    if ra is None:
        raise RotationNotFoundError(rotation_id)

    plan = db.get(Plan, ra.plan_id)
    merged = {
        "valid_from": ra.valid_from,
        "valid_to": ra.valid_to,
    }
    merged.update(data)
    validate_rotation_dates(merged, plan)  # type: ignore[arg-type]

    updated = rotation_repo.update_rotation(db, rotation_id, data)
    db.commit()
    return updated  # type: ignore[return-value]
