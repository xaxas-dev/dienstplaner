from __future__ import annotations

from datetime import date, time

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — alle ORM-Modelle registrieren
from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity
from app.solver.tarif_rules import ConstraintId


# ---------------------------------------------------------------------------
# Test-Helpers
# ---------------------------------------------------------------------------


def _make_plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


def _make_doctor(db: Session, name: str = "Dr. Test", opt_out_bd_level: int | None = None) -> Doctor:
    d = Doctor(name=name, opt_out_bd_level=opt_out_bd_level)
    db.add(d)
    db.flush()
    return d


def _make_shift_type(
    db: Session,
    name: str,
    short_name: str,
    is_bd: bool = False,
    start_time: time | None = None,
    end_time: time | None = None,
) -> ShiftType:
    st = ShiftType(
        name=name,
        short_name=short_name,
        is_bereitschaftsdienst=is_bd,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(st)
    db.flush()
    return st


def _make_shift(
    db: Session,
    plan_id: int,
    shift_date: date,
    shift_type_id: int,
    doctor_id: int | None = None,
) -> Shift:
    s = Shift(
        plan_id=plan_id,
        shift_date=shift_date,
        shift_type_id=shift_type_id,
        doctor_id=doctor_id,
    )
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# MaxBdPerMonthRule
# ---------------------------------------------------------------------------


def test_max_bd_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    for day in range(1, 5):  # 4 BD-Shifts — genau am Limit
        _make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor.id)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_bd_violation_produces_one_warning_per_excess_shift(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    shifts = []
    for day in range(1, 7):  # 6 BD-Shifts → 2 Excess (Shift #5 und #6)
        shifts.append(_make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor.id))

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)

    assert len(warnings) == 2
    assert all(w.rule_id == ConstraintId.MAX_BD_PER_MONTH for w in warnings)
    assert all(w.severity == TarifSeverity.CRITICAL for w in warnings)
    assert all(w.doctor_id == doctor.id for w in warnings)
    excess_shift_ids = {shifts[4].id, shifts[5].id}
    assert {w.shift_id for w in warnings} == excess_shift_ids


def test_max_bd_unassigned_shifts_ignored(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    bd_type = _make_shift_type(db, "BD", "BD", is_bd=True)

    for day in range(1, 7):  # 6 BD-Shifts ohne doctor_id
        _make_shift(db, plan.id, date(2026, 6, day), bd_type.id, doctor_id=None)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_bd_non_bd_shifts_not_counted(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxBdPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    normal_type = _make_shift_type(db, "Frühdienst", "F", is_bd=False)

    for day in range(1, 7):  # 6 Nicht-BD-Shifts
        _make_shift(db, plan.id, date(2026, 6, day), normal_type.id, doctor.id)

    warnings = MaxBdPerMonthRule().evaluate(db, plan.id)
    assert warnings == []
