from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Absence,
    AbsenceType,
    Department,
    Doctor,
    Plan,
    PlanStatus,
    PlanVersion,
    RotationAssignment,
    Shift,
    ShiftType,
    Wish,
    WishType,
)
from app.schemas.wish import WishCreate

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _make_doctor(db: Session, name: str = "Dr. Test") -> Doctor:
    doctor = Doctor(name=name)
    db.add(doctor)
    db.flush()
    return doctor


def _make_shift_type(db: Session, name: str = "V-Test", short_name: str = "VT") -> ShiftType:
    st = ShiftType(name=name, short_name=short_name)
    db.add(st)
    db.flush()
    return st


def _make_department(db: Session, name: str = "Testbereich") -> Department:
    dept = Department(name=name, display_order=99)
    db.add(dept)
    db.flush()
    return dept


def _make_plan(
    db: Session,
    name: str = "Testplan April 2026",
    valid_from: date = date(2026, 4, 1),
    valid_to: date = date(2026, 4, 30),
) -> Plan:
    plan = Plan(name=name, valid_from=valid_from, valid_to=valid_to)
    db.add(plan)
    db.flush()
    return plan


# ---------------------------------------------------------------------------
# Plan
# ---------------------------------------------------------------------------


def test_plan_create_and_query(db: Session) -> None:
    plan = _make_plan(db)

    result = db.get(Plan, plan.id)
    assert result is not None
    assert result.name == "Testplan April 2026"
    assert result.valid_from == date(2026, 4, 1)
    assert result.valid_to == date(2026, 4, 30)
    assert result.status == PlanStatus.DRAFT
    assert result.created_at is not None
    assert result.updated_at is not None


def test_plan_invalid_date_range(db: Session) -> None:
    plan = Plan(name="Ungültig", valid_from=date(2026, 4, 30), valid_to=date(2026, 4, 1))
    db.add(plan)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# ---------------------------------------------------------------------------
# PlanVersion
# ---------------------------------------------------------------------------


def test_plan_version_unique_number(db: Session) -> None:
    plan = _make_plan(db, name="Versionsplan")
    snapshot = {"plan": {}, "shifts": [], "rotation_assignments": []}

    v1 = PlanVersion(plan_id=plan.id, version_number=1, snapshot_json=snapshot)
    db.add(v1)
    db.flush()

    v2 = PlanVersion(plan_id=plan.id, version_number=1, snapshot_json=snapshot)
    db.add(v2)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_plan_version_snapshot_json_roundtrip(db: Session) -> None:
    plan = _make_plan(db, name="Snapshot-Plan")
    payload = {"plan": {"id": 1, "name": "x"}, "shifts": [{"id": 1}], "rotation_assignments": []}

    pv = PlanVersion(plan_id=plan.id, version_number=1, snapshot_json=payload, comment="Init")
    db.add(pv)
    db.flush()
    db.expire(pv)

    result = db.get(PlanVersion, pv.id)
    assert result is not None
    assert result.snapshot_json == payload
    assert result.comment == "Init"


# ---------------------------------------------------------------------------
# Shift
# ---------------------------------------------------------------------------


def test_shift_unique_per_day_and_type(db: Session) -> None:
    plan = _make_plan(db, name="Shift-Unique-Plan")
    st = _make_shift_type(db, name="N-Test", short_name="NT")

    s1 = Shift(plan_id=plan.id, shift_date=date(2026, 4, 5), shift_type_id=st.id)
    db.add(s1)
    db.flush()

    s2 = Shift(plan_id=plan.id, shift_date=date(2026, 4, 5), shift_type_id=st.id)
    db.add(s2)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_shift_unassigned(db: Session) -> None:
    plan = _make_plan(db, name="Unbesetzt-Plan")
    st = _make_shift_type(db, name="T-Test", short_name="TT")

    shift = Shift(plan_id=plan.id, shift_date=date(2026, 4, 6), shift_type_id=st.id, doctor_id=None)
    db.add(shift)
    db.flush()

    result = db.get(Shift, shift.id)
    assert result is not None
    assert result.doctor_id is None


def test_shift_pinned_default_false(db: Session) -> None:
    plan = _make_plan(db, name="Pin-Plan")
    st = _make_shift_type(db, name="P-Test", short_name="PT")

    shift = Shift(plan_id=plan.id, shift_date=date(2026, 4, 7), shift_type_id=st.id)
    db.add(shift)
    db.flush()

    result = db.get(Shift, shift.id)
    assert result is not None
    assert result.is_pinned is False


# ---------------------------------------------------------------------------
# RotationAssignment
# ---------------------------------------------------------------------------


def test_rotation_assignment_overlap_allowed(db: Session) -> None:
    plan = _make_plan(db, name="Rotation-Plan")
    doctor = _make_doctor(db, "Dr. Rotation")
    dept = _make_department(db, "Rotationsbereich")

    ra1 = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=date(2026, 4, 1),
        valid_to=date(2026, 4, 15),
    )
    ra2 = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=date(2026, 4, 10),
        valid_to=date(2026, 4, 30),
    )
    db.add_all([ra1, ra2])
    db.flush()

    db.refresh(plan)
    assert len(plan.rotation_assignments) == 2


# ---------------------------------------------------------------------------
# Absence
# ---------------------------------------------------------------------------


def test_absence_with_doctor(db: Session) -> None:
    doctor = _make_doctor(db, "Dr. Urlaub")

    absence = Absence(
        doctor_id=doctor.id,
        absence_type=AbsenceType.URLAUB,
        valid_from=date(2026, 4, 14),
        valid_to=date(2026, 4, 18),
    )
    db.add(absence)
    db.flush()

    result = db.get(Absence, absence.id)
    assert result is not None
    assert result.absence_type == AbsenceType.URLAUB
    assert result.valid_from == date(2026, 4, 14)


# ---------------------------------------------------------------------------
# Wish
# ---------------------------------------------------------------------------


def test_wish_avoid_day_with_shift_type_null(db: Session) -> None:
    doctor = _make_doctor(db, "Dr. Wunsch")

    wish = Wish(
        doctor_id=doctor.id,
        wish_date=date(2026, 4, 20),
        wish_type=WishType.AVOID_DAY,
        shift_type_id=None,
    )
    db.add(wish)
    db.flush()

    result = db.get(Wish, wish.id)
    assert result is not None
    assert result.shift_type_id is None
    assert result.priority == 1


def test_wish_priority_range(db: Session) -> None:
    doctor = _make_doctor(db, "Dr. Prio")

    wish = Wish(
        doctor_id=doctor.id,
        wish_date=date(2026, 4, 21),
        wish_type=WishType.AVOID_DAY,
        priority=4,
    )
    db.add(wish)
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


# ---------------------------------------------------------------------------
# Cascade
# ---------------------------------------------------------------------------


def test_cascade_plan_delete(db: Session) -> None:
    plan = _make_plan(db, name="Cascade-Plan")
    doctor = _make_doctor(db, "Dr. Cascade")
    dept = _make_department(db, "Cascade-Bereich")
    st = _make_shift_type(db, name="C-Test", short_name="CT")

    shift = Shift(
        plan_id=plan.id, shift_date=date(2026, 4, 1), shift_type_id=st.id, doctor_id=doctor.id
    )
    ra = RotationAssignment(
        plan_id=plan.id,
        doctor_id=doctor.id,
        department_id=dept.id,
        valid_from=date(2026, 4, 1),
        valid_to=date(2026, 4, 30),
    )
    pv = PlanVersion(
        plan_id=plan.id,
        version_number=1,
        snapshot_json={"plan": {}, "shifts": [], "rotation_assignments": []},
    )
    db.add_all([shift, ra, pv])
    db.flush()

    shift_id = shift.id
    ra_id = ra.id
    pv_id = pv.id
    doctor_id = doctor.id
    dept_id = dept.id

    db.delete(plan)
    db.flush()

    assert db.get(Shift, shift_id) is None
    assert db.get(RotationAssignment, ra_id) is None
    assert db.get(PlanVersion, pv_id) is None

    # Doctors und Departments dürfen NICHT kaskadiert gelöscht sein
    assert db.get(Doctor, doctor_id) is not None
    assert db.get(Department, dept_id) is not None


# ---------------------------------------------------------------------------
# Pydantic-Schema: Cross-Field-Validation für Wishes
# ---------------------------------------------------------------------------


def test_wish_schema_avoid_day_no_shift_type() -> None:
    w = WishCreate(
        doctor_id=1,
        wish_date=date(2026, 4, 20),
        wish_type=WishType.AVOID_DAY,
        shift_type_id=None,
    )
    assert w.shift_type_id is None


def test_wish_schema_avoid_day_with_shift_type_raises() -> None:
    with pytest.raises(Exception):
        WishCreate(
            doctor_id=1,
            wish_date=date(2026, 4, 20),
            wish_type=WishType.AVOID_DAY,
            shift_type_id=5,
        )


def test_wish_schema_avoid_shift_requires_shift_type() -> None:
    with pytest.raises(Exception):
        WishCreate(
            doctor_id=1,
            wish_date=date(2026, 4, 20),
            wish_type=WishType.AVOID_SHIFT,
            shift_type_id=None,
        )


def test_wish_schema_avoid_shift_with_shift_type() -> None:
    w = WishCreate(
        doctor_id=1,
        wish_date=date(2026, 4, 20),
        wish_type=WishType.AVOID_SHIFT,
        shift_type_id=3,
    )
    assert w.shift_type_id == 3
