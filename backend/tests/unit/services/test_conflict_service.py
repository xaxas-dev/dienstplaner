"""Unit-Tests für conflict_service.detect_conflicts."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 – alle Modelle registrieren
from app.models.absence import Absence, AbsenceType
from app.models.department import Department
from app.models.doctor import Doctor
from app.models.ina_exclusion import INAExclusion, INAExclusionReason
from app.models.plan import Plan, PlanStatus
from app.models.rotation_assignment import RotationAssignment
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.conflict import ConflictType
from app.services import conflict_service
from app.services.exceptions import PlanNotFoundError

SHIFT_DATE = date(2026, 5, 4)  # Montag


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _make_doctor(db: Session, name: str = "Dr. Test") -> Doctor:
    doc = Doctor(name=name, active=True)
    db.add(doc)
    db.flush()
    return doc


def _make_shift_type(db: Session, short_name: str = "V", display_order: int = 1) -> ShiftType:
    st = ShiftType(
        name=f"Dienst-{short_name}",
        short_name=short_name,
        applies_on_weekdays=True,
        applies_on_weekend=True,
        display_order=display_order,
        active=True,
    )
    db.add(st)
    db.flush()
    return st


def _make_plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 5, 1),
        valid_to=date(2026, 5, 31),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


def _make_shift(
    db: Session,
    plan: Plan,
    shift_type: ShiftType,
    shift_date: date = SHIFT_DATE,
    doctor: Doctor | None = None,
) -> Shift:
    s = Shift(
        plan_id=plan.id,
        shift_date=shift_date,
        shift_type_id=shift_type.id,
        doctor_id=doctor.id if doctor else None,
        is_pinned=False,
    )
    db.add(s)
    db.flush()
    return s


def _make_absence(db: Session, doctor: Doctor, on_date: date = SHIFT_DATE) -> None:
    db.add(
        Absence(
            doctor_id=doctor.id,
            absence_type=AbsenceType.URLAUB,
            valid_from=on_date,
            valid_to=on_date,
        )
    )
    db.flush()


def _make_blocking_dept(db: Session) -> Department:
    dept = Department(name="SU-Test", blocks_ina_weekdays=True, blocks_ina_weekends=False)
    db.add(dept)
    db.flush()
    return dept


def _make_rotation(db: Session, plan: Plan, doctor: Doctor, dept: Department) -> None:
    db.add(
        RotationAssignment(
            plan_id=plan.id,
            doctor_id=doctor.id,
            department_id=dept.id,
            valid_from=date(2026, 5, 1),
            valid_to=date(2026, 5, 31),
        )
    )
    db.flush()


def _make_ina_exclusion(db: Session, doctor: Doctor) -> None:
    db.add(
        INAExclusion(
            doctor_id=doctor.id,
            valid_from=date(2026, 5, 1),
            valid_to=None,
            reason=INAExclusionReason.SCHWANGERSCHAFT,
        )
    )
    db.flush()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_plan_not_found_raises(db: Session) -> None:
    with pytest.raises(PlanNotFoundError):
        conflict_service.detect_conflicts(db, 999999)


def test_no_conflicts_empty_plan(db: Session) -> None:
    plan = _make_plan(db)
    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.plan_id == plan.id
    assert result.conflicts == []
    assert result.conflict_count == 0
    assert result.open_shifts == []
    assert result.open_shift_count == 0


def test_open_shift_counted_not_conflict(db: Session) -> None:
    plan = _make_plan(db)
    st = _make_shift_type(db)
    _make_shift(db, plan, st, doctor=None)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.open_shift_count == 1
    assert result.conflicts == []
    assert result.conflict_count == 0


def test_available_single_shift_no_conflict(db: Session) -> None:
    plan = _make_plan(db)
    st = _make_shift_type(db)
    doctor = _make_doctor(db)
    _make_shift(db, plan, st, doctor=doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.conflicts == []
    assert result.conflict_count == 0


def test_doctor_on_vacation_is_not_available(db: Session) -> None:
    plan = _make_plan(db)
    st = _make_shift_type(db)
    doctor = _make_doctor(db)
    shift = _make_shift(db, plan, st, doctor=doctor)
    _make_absence(db, doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.conflict_count == 1
    c = result.conflicts[0]
    assert c.shift_id == shift.id
    assert c.conflict_type == ConflictType.NOT_AVAILABLE
    assert "Abwesenheit" in c.message


def test_doctor_blocking_rotation_is_not_available(db: Session) -> None:
    plan = _make_plan(db)
    st = _make_shift_type(db)
    doctor = _make_doctor(db)
    shift = _make_shift(db, plan, st, doctor=doctor)
    dept = _make_blocking_dept(db)
    _make_rotation(db, plan, doctor, dept)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.conflict_count == 1
    c = result.conflicts[0]
    assert c.shift_id == shift.id
    assert c.conflict_type == ConflictType.NOT_AVAILABLE
    assert "Rotation" in c.message


def test_ina_exclusion_is_not_available(db: Session) -> None:
    plan = _make_plan(db)
    st = _make_shift_type(db)
    doctor = _make_doctor(db)
    shift = _make_shift(db, plan, st, doctor=doctor)
    _make_ina_exclusion(db, doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.conflict_count == 1
    c = result.conflicts[0]
    assert c.shift_id == shift.id
    assert c.conflict_type == ConflictType.NOT_AVAILABLE
    assert "Schwangerschaft" in c.message


def test_double_booking_marks_all_involved_shifts(db: Session) -> None:
    plan = _make_plan(db)
    st1 = _make_shift_type(db, short_name="V", display_order=1)
    st2 = _make_shift_type(db, short_name="N", display_order=2)
    doctor = _make_doctor(db)
    shift1 = _make_shift(db, plan, st1, doctor=doctor)
    shift2 = _make_shift(db, plan, st2, doctor=doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    double_booked = [c for c in result.conflicts if c.conflict_type == ConflictType.DOUBLE_BOOKED]
    assert len(double_booked) == 2
    shift_ids = {c.shift_id for c in double_booked}
    assert shift1.id in shift_ids
    assert shift2.id in shift_ids


def test_shift_can_have_both_conflict_types(db: Session) -> None:
    """Doctor im Urlaub UND doppelt gebucht → beide Typen für dieselbe shift_id."""
    plan = _make_plan(db)
    st1 = _make_shift_type(db, short_name="V", display_order=1)
    st2 = _make_shift_type(db, short_name="N", display_order=2)
    doctor = _make_doctor(db)
    shift1 = _make_shift(db, plan, st1, doctor=doctor)
    _make_shift(db, plan, st2, doctor=doctor)
    _make_absence(db, doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    shift1_conflicts = [c for c in result.conflicts if c.shift_id == shift1.id]
    types = {c.conflict_type for c in shift1_conflicts}
    assert ConflictType.NOT_AVAILABLE in types
    assert ConflictType.DOUBLE_BOOKED in types


def test_conflict_count_matches_list_length(db: Session) -> None:
    plan = _make_plan(db)
    st1 = _make_shift_type(db, short_name="V", display_order=1)
    st2 = _make_shift_type(db, short_name="N", display_order=2)
    doctor = _make_doctor(db)
    _make_shift(db, plan, st1, doctor=None)  # offen
    _make_shift(db, plan, st2, doctor=doctor)
    _make_absence(db, doctor)

    result = conflict_service.detect_conflicts(db, plan.id)
    assert result.conflict_count == len(result.conflicts)
    assert result.open_shift_count == len(result.open_shifts)
