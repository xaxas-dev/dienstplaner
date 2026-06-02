from __future__ import annotations

from datetime import date, time

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


def _make_doctor(
    db: Session, name: str = "Dr. Test", opt_out_bd_level: int | None = None
) -> Doctor:
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


# ---------------------------------------------------------------------------
# MaxWeekendsPerMonthRule
# ---------------------------------------------------------------------------


def test_max_weekends_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # June 2026: Sa=6, So=7 → Wochenende KW23; 13, 14 → KW24
    we_type = _make_shift_type(db, "WE-Dienst", "WE")

    # Genau 2 Wochenend-Shifts
    _make_shift(db, plan.id, date(2026, 6, 6), we_type.id, doctor.id)   # Sa
    _make_shift(db, plan.id, date(2026, 6, 7), we_type.id, doctor.id)   # So

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


def test_max_weekends_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    we_type = _make_shift_type(db, "WE-Dienst2", "WE2")

    # 3 Wochenend-Shifts → 1 Excess
    shifts = [
        _make_shift(db, plan.id, date(2026, 6, 6), we_type.id, doctor.id),   # Sa
        _make_shift(db, plan.id, date(2026, 6, 7), we_type.id, doctor.id),   # So
        _make_shift(db, plan.id, date(2026, 6, 13), we_type.id, doctor.id),  # Sa
    ]

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].rule_id == ConstraintId.MAX_WEEKENDS_PER_MONTH
    assert warnings[0].severity == TarifSeverity.WARNING
    assert warnings[0].doctor_id == doctor.id
    assert warnings[0].shift_id == shifts[2].id


def test_max_weekends_weekday_shifts_not_counted(db: Session) -> None:
    from app.services.tarif_rules_impl import MaxWeekendsPerMonthRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    wd_type = _make_shift_type(db, "Wochentag", "WT")

    for day in range(1, 6):  # Mo–Fr
        _make_shift(db, plan.id, date(2026, 6, day), wd_type.id, doctor.id)

    warnings = MaxWeekendsPerMonthRule().evaluate(db, plan.id)
    assert warnings == []


# ---------------------------------------------------------------------------
# MinRestTimeRule
# ---------------------------------------------------------------------------


def test_min_rest_no_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Tag-Dienst: 08:00–16:00 → Ruhezeit bis nächsten Tag 08:00 = 16h > 11h
    tag_type = _make_shift_type(db, "Tag", "T", start_time=time(8, 0), end_time=time(16, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), tag_type.id, doctor.id)
    _make_shift(db, plan.id, date(2026, 6, 2), tag_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)
    assert warnings == []


def test_min_rest_violation(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Spätdienst: 14:00–22:00 auf June 1
    spaet_type = _make_shift_type(db, "Spät", "S", start_time=time(14, 0), end_time=time(22, 0))
    # Frühdienst: 06:00–14:00 auf June 2 → Ruhezeit = 22:00–06:00 = 8h < 11h
    frueh_type = _make_shift_type(db, "Früh", "Fr", start_time=time(6, 0), end_time=time(14, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), spaet_type.id, doctor.id)
    shift2 = _make_shift(db, plan.id, date(2026, 6, 2), frueh_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].rule_id == ConstraintId.MIN_REST_TIME
    assert warnings[0].severity == TarifSeverity.CRITICAL
    assert warnings[0].shift_id == shift2.id
    assert warnings[0].doctor_id == doctor.id
    assert "8h 0min" in warnings[0].message


def test_min_rest_overnight_shift_handled(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # Nachtdienst: 20:00–08:00 (overnight) auf June 1 → endet June 2 08:00
    nacht_type = _make_shift_type(db, "Nacht", "N", start_time=time(20, 0), end_time=time(8, 0))
    # Folgedienst: 12:00 June 2 → Ruhezeit 08:00–12:00 = 4h < 11h → Violation
    mittag_type = _make_shift_type(db, "Mittag", "M", start_time=time(12, 0), end_time=time(20, 0))

    _make_shift(db, plan.id, date(2026, 6, 1), nacht_type.id, doctor.id)
    shift2 = _make_shift(db, plan.id, date(2026, 6, 2), mittag_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)

    assert len(warnings) == 1
    assert warnings[0].shift_id == shift2.id


def test_min_rest_missing_times_skipped(db: Session) -> None:
    from app.services.tarif_rules_impl import MinRestTimeRule

    plan = _make_plan(db)
    doctor = _make_doctor(db)
    # ShiftType ohne Zeiten → Paar überspringen
    no_time_type = _make_shift_type(db, "Allgemein", "AG", start_time=None, end_time=None)

    _make_shift(db, plan.id, date(2026, 6, 1), no_time_type.id, doctor.id)
    _make_shift(db, plan.id, date(2026, 6, 2), no_time_type.id, doctor.id)

    warnings = MinRestTimeRule().evaluate(db, plan.id)
    assert warnings == []
