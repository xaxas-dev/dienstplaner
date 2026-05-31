from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.models.constraint_override import ConstraintOverride
from app.repositories import constraint_override_repository as repo
from app.repositories.shift_repository import list_shifts_for_plan
from app.services.exceptions import (
    ConstraintOverrideNotFoundError,
    ConstraintOverrideValidationError,
)
from app.solver.tarif_rules import REGULATORISCH_HART


@dataclass
class OverrideSnapshot:
    """Immutable Snapshot aller aktiven Overrides für einen Plan-Zeitraum."""

    disabled_constraints: frozenset[str] = field(default_factory=frozenset)
    doctor_overrides: dict[int, frozenset[str]] = field(default_factory=dict)
    shift_overrides: dict[int, frozenset[str]] = field(default_factory=dict)


def create_override(db: Session, data: dict) -> ConstraintOverride:
    constraint_id = data.get("constraint_id", "")
    if constraint_id not in REGULATORISCH_HART:
        raise ConstraintOverrideValidationError(
            f"Constraint '{constraint_id}' ist nicht overridebar — "
            "nur regulatorisch-harte Constraints können overridet werden."
        )
    override = repo.create_override(db, data)
    db.commit()
    db.refresh(override)
    return override


def delete_override(db: Session, override_id: int) -> None:
    if not repo.delete_override(db, override_id):
        raise ConstraintOverrideNotFoundError(override_id)
    db.commit()


def get_override_snapshot(db: Session, plan_id: int) -> OverrideSnapshot:
    """Lädt alle aktiven Overrides für einen Plan und gibt einen OverrideSnapshot zurück."""
    shifts = list_shifts_for_plan(db, plan_id)
    if not shifts:
        return OverrideSnapshot()

    plan_start: date = min(s.shift_date for s in shifts)
    plan_end: date = max(s.shift_date for s in shifts)
    shift_ids: set[int] = {s.id for s in shifts}

    overrides = repo.list_for_plan(db, plan_id, plan_start, plan_end, shift_ids)

    disabled: set[str] = set()
    doctor_ovr: dict[int, set[str]] = {}
    shift_ovr: dict[int, set[str]] = {}

    for o in overrides:
        if o.level == "A":
            disabled.add(o.constraint_id)
        elif o.level == "B" and o.doctor_id is not None:
            doctor_ovr.setdefault(o.doctor_id, set()).add(o.constraint_id)
        elif o.level == "C" and o.shift_id is not None:
            shift_ovr.setdefault(o.shift_id, set()).add(o.constraint_id)

    return OverrideSnapshot(
        disabled_constraints=frozenset(disabled),
        doctor_overrides={k: frozenset(v) for k, v in doctor_ovr.items()},
        shift_overrides={k: frozenset(v) for k, v in shift_ovr.items()},
    )
