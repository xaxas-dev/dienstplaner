"""Unit-Tests für shift_repository: get_shift und update_shift."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.repositories import shift_repository as repo

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def shift_type(db: Session) -> ShiftType:
    st = ShiftType(
        name="V-Dienst",
        short_name="V",
        applies_on_weekdays=True,
        applies_on_weekend=False,
        display_order=1,
        active=True,
    )
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 4, 1),
        valid_to=date(2026, 4, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def shift(db: Session, plan: Plan, shift_type: ShiftType) -> Shift:
    s = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 4, 1),
        shift_type_id=shift_type.id,
        doctor_id=None,
        is_pinned=False,
    )
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# get_shift
# ---------------------------------------------------------------------------


def test_get_shift_returns_shift_with_relations(db: Session, shift: Shift) -> None:
    result = repo.get_shift(db, shift.id)
    assert result is not None
    assert result.id == shift.id
    # eager-load: shift_type muss geladen sein
    assert result.shift_type is not None
    assert result.shift_type.short_name == "V"


def test_get_shift_returns_none_for_unknown_id(db: Session) -> None:
    result = repo.get_shift(db, 999999)
    assert result is None


# ---------------------------------------------------------------------------
# update_shift
# ---------------------------------------------------------------------------


def test_update_shift_sets_is_pinned(db: Session, shift: Shift) -> None:
    result = repo.update_shift(db, shift.id, {"is_pinned": True})
    assert result is not None
    assert result.is_pinned is True


def test_update_shift_sets_notes(db: Session, shift: Shift) -> None:
    result = repo.update_shift(db, shift.id, {"notes": "Notiz"})
    assert result is not None
    assert result.notes == "Notiz"


def test_update_shift_clears_doctor(db: Session, shift: Shift) -> None:
    # doctor_id explizit auf None setzen (Zuweisung aufheben)
    repo.update_shift(db, shift.id, {"doctor_id": 99})  # erstmal setzen
    result = repo.update_shift(db, shift.id, {"doctor_id": None})
    assert result is not None
    assert result.doctor_id is None


def test_update_shift_returns_none_for_unknown_id(db: Session) -> None:
    result = repo.update_shift(db, 999999, {"is_pinned": True})
    assert result is None


def test_update_shift_partial_update_leaves_other_fields(db: Session, shift: Shift) -> None:
    # Nur notes ändern – is_pinned soll unverändert bleiben
    repo.update_shift(db, shift.id, {"notes": "Nur Notiz"})
    refreshed = repo.get_shift(db, shift.id)
    assert refreshed is not None
    assert refreshed.notes == "Nur Notiz"
    assert refreshed.is_pinned is False  # unverändert
