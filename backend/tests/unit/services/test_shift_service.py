"""Unit-Tests für shift_service.update_shift."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.shift import ShiftUpdate
from app.services import shift_service
from app.services.exceptions import ShiftNotFoundError, ShiftValidationError

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


@pytest.fixture
def active_doctor(db: Session) -> Doctor:
    d = Doctor(name="Dr. Aktiv", active=True)
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def inactive_doctor(db: Session) -> Doctor:
    d = Doctor(name="Dr. Inaktiv", active=False)
    db.add(d)
    db.flush()
    return d


# ---------------------------------------------------------------------------
# ShiftNotFoundError
# ---------------------------------------------------------------------------


def test_update_shift_raises_shift_not_found(db: Session) -> None:
    update = ShiftUpdate.model_validate({"is_pinned": True})
    with pytest.raises(ShiftNotFoundError):
        shift_service.update_shift(db, 999999, update)


# ---------------------------------------------------------------------------
# ShiftValidationError
# ---------------------------------------------------------------------------


def test_update_shift_raises_validation_error_when_doctor_not_exists(
    db: Session, shift: Shift
) -> None:
    update = ShiftUpdate.model_validate({"doctor_id": 999999})
    with pytest.raises(ShiftValidationError, match="existiert nicht"):
        shift_service.update_shift(db, shift.id, update)


def test_update_shift_raises_validation_error_when_doctor_inactive(
    db: Session, shift: Shift, inactive_doctor: Doctor
) -> None:
    update = ShiftUpdate.model_validate({"doctor_id": inactive_doctor.id})
    with pytest.raises(ShiftValidationError, match="inaktiv"):
        shift_service.update_shift(db, shift.id, update)


# ---------------------------------------------------------------------------
# Erfolgreiche Updates
# ---------------------------------------------------------------------------


def test_update_shift_assigns_active_doctor(
    db: Session, shift: Shift, active_doctor: Doctor
) -> None:
    update = ShiftUpdate.model_validate({"doctor_id": active_doctor.id})
    result = shift_service.update_shift(db, shift.id, update)
    assert result.doctor_id == active_doctor.id


def test_update_shift_all_fields(db: Session, shift: Shift, active_doctor: Doctor) -> None:
    update = ShiftUpdate.model_validate(
        {"doctor_id": active_doctor.id, "is_pinned": True, "notes": "Testnotiz"}
    )
    result = shift_service.update_shift(db, shift.id, update)
    assert result.doctor_id == active_doctor.id
    assert result.is_pinned is True
    assert result.notes == "Testnotiz"


def test_update_shift_partial_leaves_other_fields(
    db: Session, shift: Shift, active_doctor: Doctor
) -> None:
    # Erst doctor setzen
    shift_service.update_shift(
        db, shift.id, ShiftUpdate.model_validate({"doctor_id": active_doctor.id})
    )
    # Nur notes ändern – doctor_id soll unverändert bleiben
    result = shift_service.update_shift(
        db, shift.id, ShiftUpdate.model_validate({"notes": "Nur Notiz"})
    )
    assert result.doctor_id == active_doctor.id
    assert result.notes == "Nur Notiz"


def test_update_shift_clears_doctor(
    db: Session, shift: Shift, active_doctor: Doctor
) -> None:
    shift_service.update_shift(
        db, shift.id, ShiftUpdate.model_validate({"doctor_id": active_doctor.id})
    )
    # doctor_id explizit auf None → Zuweisung aufheben
    result = shift_service.update_shift(
        db, shift.id, ShiftUpdate.model_validate({"doctor_id": None})
    )
    assert result.doctor_id is None


def test_update_shift_doctor_id_none_not_validated(db: Session, shift: Shift) -> None:
    """doctor_id=None (explizit) darf NICHT die Doctor-Existenzprüfung auslösen."""
    update = ShiftUpdate.model_validate({"doctor_id": None})
    result = shift_service.update_shift(db, shift.id, update)
    assert result.doctor_id is None
