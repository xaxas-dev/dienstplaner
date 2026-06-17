"""Tests für locked_week_service."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift_type import ShiftType
from app.schemas.locked_week import LockedWeekCreate
from app.services import locked_week_service
from app.services.exceptions import PlanNotFoundError

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def department(db: Session) -> Department:
    dept = Department(name="INA", display_order=1)
    db.add(dept)
    db.flush()
    return dept


@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="Juni 2026",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor(db: Session) -> Doctor:
    d = Doctor(
        last_name="Anna Müller",
        short_name="AMü",
        active=True,
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def shift_type_n(db: Session) -> ShiftType:
    st = ShiftType(
        name="Nachtdienst",
        short_name="N",
        display_order=1,
        applies_on_weekend=True,
    )
    db.add(st)
    db.flush()
    return st


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

SUNDAY_2026_06_07 = date(2026, 6, 7)   # Sonntag
MONDAY_2026_06_08 = date(2026, 6, 8)   # Montag


def test_create_locked_week_creates_5_shifts(db, plan, doctor, shift_type_n):
    """5 aufeinanderfolgende Shifts So–Do werden erstellt."""
    data = LockedWeekCreate(
        doctor_id=doctor.id,
        start_date=SUNDAY_2026_06_07,
        shift_type_id=shift_type_n.id,
    )
    result = locked_week_service.create_locked_week(db, plan.id, data)

    assert len(result.created) == 5
    assert len(result.skipped) == 0
    dates = [s.shift_date for s in result.created]
    assert dates == [date(2026, 6, 7 + i) for i in range(5)]
    for s in result.created:
        assert s.is_locked is True
        assert s.is_pinned is True
        assert s.doctor_id == doctor.id


def test_create_locked_week_raises_on_non_sunday(db, plan, doctor, shift_type_n):
    """Kein Sonntag → ValueError."""
    data = LockedWeekCreate(
        doctor_id=doctor.id,
        start_date=MONDAY_2026_06_08,
        shift_type_id=shift_type_n.id,
    )
    with pytest.raises(ValueError, match="Sonntag"):
        locked_week_service.create_locked_week(db, plan.id, data)


def test_create_locked_week_raises_on_unknown_plan(db, doctor, shift_type_n):
    """Unbekannte plan_id → PlanNotFoundError."""
    data = LockedWeekCreate(
        doctor_id=doctor.id,
        start_date=SUNDAY_2026_06_07,
        shift_type_id=shift_type_n.id,
    )
    with pytest.raises(PlanNotFoundError):
        locked_week_service.create_locked_week(db, 99999, data)


def test_create_locked_week_updates_existing_shifts(db, plan, doctor, shift_type_n):
    """Bereits existierende Shifts werden aktualisiert (is_locked + is_pinned), nicht dupliziert."""
    from app.models.shift import Shift

    # Shift für Sonntag vorab anlegen
    existing = Shift(
        plan_id=plan.id,
        shift_date=SUNDAY_2026_06_07,
        shift_type_id=shift_type_n.id,
        doctor_id=doctor.id,
    )
    db.add(existing)
    db.flush()
    existing_id = existing.id

    data = LockedWeekCreate(
        doctor_id=doctor.id,
        start_date=SUNDAY_2026_06_07,
        shift_type_id=shift_type_n.id,
    )
    result = locked_week_service.create_locked_week(db, plan.id, data)

    assert len(result.created) == 5  # alle 5 Tage in created (So aktualisiert, Mo–Do neu)
    assert len(result.skipped) == 0
    ids = [s.id for s in result.created]
    assert existing_id in ids
    updated = next(s for s in result.created if s.id == existing_id)
    assert updated.is_locked is True
    assert updated.is_pinned is True
