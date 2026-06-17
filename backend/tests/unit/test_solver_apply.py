"""Unit-Tests für solver_service.apply_solution (Sub-Schritt B).

Kein JVM-Guard — apply_solution braucht kein timefold.
Ruft apply_solution(db, plan_id, proposed) direkt auf.
"""
from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.plan import Plan, PlanStatus
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.solve import ProposedAssignment
from app.services.exceptions import PlanNotFoundError, ShiftValidationError
from app.solver.solver_service import apply_solution


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def shift_type(db: Session) -> ShiftType:
    st = ShiftType(name="V-Apply", short_name="VA", display_order=1, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def shift_type_2(db: Session) -> ShiftType:
    st = ShiftType(name="N-Apply", short_name="NA", display_order=2, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="ApplyTest",
        valid_from=date(2026, 7, 1),
        valid_to=date(2026, 7, 1),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def other_plan(db: Session) -> Plan:
    p = Plan(
        name="OtherPlan",
        valid_from=date(2026, 7, 1),
        valid_to=date(2026, 7, 1),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor_active(db: Session) -> Doctor:
    d = Doctor(last_name="Dr. Active", active=True)
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def doctor_inactive(db: Session) -> Doctor:
    d = Doctor(last_name="Dr. Inactive", active=False)
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def open_shift(db: Session, plan: Plan, shift_type: ShiftType) -> Shift:
    s = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 7, 1),
        shift_type_id=shift_type.id,
        doctor_id=None,
        is_pinned=False,
    )
    db.add(s)
    db.flush()
    return s


@pytest.fixture
def pinned_shift(db: Session, plan: Plan, shift_type_2: ShiftType, doctor_active: Doctor) -> Shift:
    s = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 7, 1),
        shift_type_id=shift_type_2.id,
        doctor_id=doctor_active.id,
        is_pinned=True,
    )
    db.add(s)
    db.flush()
    return s


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_apply_schreibt_doctor_id(
    db: Session,
    plan: Plan,
    open_shift: Shift,
    doctor_active: Doctor,
) -> None:
    """apply_solution schreibt doctor_id in die DB."""
    proposed = [ProposedAssignment(shift_id=open_shift.id, doctor_id=doctor_active.id)]
    result = apply_solution(db, plan.id, proposed)

    assert open_shift.id in result.applied
    assert result.skipped_pinned == []
    db.refresh(open_shift)
    assert open_shift.doctor_id == doctor_active.id


def test_apply_is_pinned_bleibt_false(
    db: Session,
    plan: Plan,
    open_shift: Shift,
    doctor_active: Doctor,
) -> None:
    """Apply setzt is_pinned nicht — Solver-Zuweisungen bleiben ungepinnt."""
    proposed = [ProposedAssignment(shift_id=open_shift.id, doctor_id=doctor_active.id)]
    apply_solution(db, plan.id, proposed)

    db.refresh(open_shift)
    assert open_shift.is_pinned is False


def test_apply_gepinnter_shift_wird_uebersprungen(
    db: Session,
    plan: Plan,
    pinned_shift: Shift,
    doctor_active: Doctor,
) -> None:
    """Gepinnter Shift landet in skipped_pinned, DB bleibt unverändert."""
    original_doctor_id = pinned_shift.doctor_id
    proposed = [ProposedAssignment(shift_id=pinned_shift.id, doctor_id=None)]
    result = apply_solution(db, plan.id, proposed)

    assert pinned_shift.id in result.skipped_pinned
    assert result.applied == []
    db.refresh(pinned_shift)
    assert pinned_shift.doctor_id == original_doctor_id


def test_apply_unbekannter_shift_gibt_422(
    db: Session,
    plan: Plan,
) -> None:
    """Shift-ID, die nicht in plan_id ist, löst ShiftValidationError aus."""
    proposed = [ProposedAssignment(shift_id=99999, doctor_id=None)]
    with pytest.raises(ShiftValidationError):
        apply_solution(db, plan.id, proposed)


def test_apply_shift_aus_fremdem_plan_gibt_422(
    db: Session,
    plan: Plan,
    other_plan: Plan,
    shift_type: ShiftType,
    doctor_active: Doctor,
) -> None:
    """Shift aus einem anderen Plan löst ShiftValidationError aus."""
    foreign_shift = Shift(
        plan_id=other_plan.id,
        shift_date=date(2026, 7, 1),
        shift_type_id=shift_type.id,
        doctor_id=None,
        is_pinned=False,
    )
    db.add(foreign_shift)
    db.flush()

    proposed = [ProposedAssignment(shift_id=foreign_shift.id, doctor_id=doctor_active.id)]
    with pytest.raises(ShiftValidationError):
        apply_solution(db, plan.id, proposed)


def test_apply_inaktiver_doctor_gibt_422(
    db: Session,
    plan: Plan,
    open_shift: Shift,
    doctor_inactive: Doctor,
) -> None:
    """Inaktiver Arzt löst ShiftValidationError aus."""
    proposed = [ProposedAssignment(shift_id=open_shift.id, doctor_id=doctor_inactive.id)]
    with pytest.raises(ShiftValidationError):
        apply_solution(db, plan.id, proposed)


def test_apply_plan_nicht_gefunden(db: Session) -> None:
    """Unbekannte plan_id löst PlanNotFoundError aus."""
    proposed = [ProposedAssignment(shift_id=1, doctor_id=None)]
    with pytest.raises(PlanNotFoundError):
        apply_solution(db, 99999, proposed)


def test_apply_leere_liste_ist_gueltig(db: Session, plan: Plan) -> None:
    """Leere proposed_assignments ist gültig — kein Write, kein Fehler."""
    result = apply_solution(db, plan.id, [])
    assert result.plan_id == plan.id
    assert result.applied == []
    assert result.skipped_pinned == []
