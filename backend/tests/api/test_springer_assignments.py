from datetime import date, datetime

import pytest
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor, DoctorType
from app.models.plan import Plan
from app.repositories import springer_repository as repo
from app.schemas.springer_assignment import SpringerAssignmentCreate


@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 1, 31),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor(db: Session) -> Doctor:
    d = Doctor(
        name="Test Arzt",
        short_name="TA",
        doctor_type=DoctorType.INTERNAL,
        active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_a(db: Session) -> Department:
    d = Department(
        name="Station A",
        short_name="STA",
        active=True,
        display_order=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_b(db: Session) -> Department:
    d = Department(
        name="Station B",
        short_name="STB",
        active=True,
        display_order=2,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


def test_get_by_plan_empty(db: Session, plan: Plan) -> None:
    result = repo.get_by_plan(db, plan.id)
    assert result == []


def test_get_by_plan_nonexistent(db: Session) -> None:
    result = repo.get_by_plan(db, 9999)
    assert result == []


def test_upsert_creates_new(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    data = SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    )
    result = repo.upsert(db, plan.id, data)
    db.commit()
    assert result.id is not None
    assert result.plan_id == plan.id
    assert result.shift_date == date(2026, 1, 15)
    assert result.doctor_id == doctor.id
    assert result.target_department_id == dept_a.id


def test_upsert_updates_existing(
    db: Session, plan: Plan, doctor: Doctor, dept_a: Department, dept_b: Department
) -> None:
    first = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()
    second = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_b.id,
    ))
    db.commit()
    assert second.id == first.id
    assert second.target_department_id == dept_b.id


def test_upsert_two_doctors_same_day(
    db: Session, plan: Plan, dept_a: Department, dept_b: Department
) -> None:
    doctor2 = Doctor(
        name="Arzt B", short_name="AB", doctor_type=DoctorType.INTERNAL, active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor2)
    db.flush()
    doctor3 = Doctor(
        name="Arzt C", short_name="AC", doctor_type=DoctorType.INTERNAL, active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor3)
    db.flush()
    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor2.id, target_department_id=dept_a.id,
    ))
    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor3.id, target_department_id=dept_b.id,
    ))
    db.commit()
    results = repo.get_by_plan(db, plan.id)
    assert len(results) == 2


def test_delete_existing(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    sa = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()
    ok = repo.delete(db, sa.id)
    db.commit()
    assert ok is True
    assert repo.get_by_plan(db, plan.id) == []


def test_delete_nonexistent(db: Session) -> None:
    assert repo.delete(db, 9999) is False
