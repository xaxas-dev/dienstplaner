"""Tests für solver/mapping.py: ORM → Solver-Domäne (Sub-Schritt C).

Kein direkter Solver-Lauf, aber Import von app.solver.domain startet JVM.
→ JVM-Guard wie in test_solver_domain.py.
"""
from datetime import date

import pytest
from sqlalchemy.orm import Session

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    import app.models  # noqa: F401 – alle Modelle registrieren
    from app.models import (
        Absence,
        AbsenceType,
        Department,
        Doctor,
        Plan,
        PlanStatus,
        RotationAssignment,
    )
    from app.models.shift import Shift
    from app.models.shift_type import ShiftType
    from app.solver.domain import SolverDoctor, SolverShift
    from app.solver.mapping import to_solver

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def shift_type_v(db: Session) -> "ShiftType":
    st = ShiftType(name="V-Solver", short_name="VS", display_order=1, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def shift_type_t(db: Session) -> "ShiftType":
    st = ShiftType(name="T-Solver", short_name="TS", display_order=2, active=True)
    db.add(st)
    db.flush()
    return st


@pytest.fixture
def plan(db: Session) -> "Plan":
    p = Plan(
        name="Solver-Testplan",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor_alice(db: Session) -> "Doctor":
    d = Doctor(name="Dr. Alice", active=True)
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def doctor_bob(db: Session) -> "Doctor":
    d = Doctor(name="Dr. Bob", active=True)
    db.add(d)
    db.flush()
    return d


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_to_solver_leerer_plan(db: Session, plan: "Plan", doctor_alice: "Doctor") -> None:
    """Plan ohne Shifts → ShiftSchedule mit 0 Shifts, aber Ärzte im Werte-Bereich."""
    schedule = to_solver(db, plan.id)

    assert len(schedule.shifts) == 0
    # Ärzte-Werte-Bereich enthält aktive Ärzte
    assert any(sd.doctor_id == doctor_alice.id for sd in schedule.doctors)


def test_to_solver_offener_shift(
    db: Session, plan: "Plan", shift_type_v: "ShiftType", doctor_alice: "Doctor"
) -> None:
    """Offener Shift (doctor_id=None) → SolverShift mit doctor=None, is_pinned=False."""
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=None,
        is_pinned=False,
    )
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    assert len(schedule.shifts) == 1
    s = schedule.shifts[0]
    assert isinstance(s, SolverShift)
    assert s.id == shift.id
    assert s.doctor is None
    assert s.is_pinned is False


def test_to_solver_gepinnter_shift_mit_arzt(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    doctor_alice: "Doctor",
) -> None:
    """Gepinnter Shift mit Arzt → SolverShift mit doctor gesetzt, is_pinned=True."""
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=doctor_alice.id,
        is_pinned=True,
    )
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    s = schedule.shifts[0]
    assert s.is_pinned is True
    assert isinstance(s.doctor, SolverDoctor)
    assert s.doctor.doctor_id == doctor_alice.id


def test_to_solver_gepinnt_ohne_arzt_wird_nicht_gepinnt(
    db: Session, plan: "Plan", shift_type_v: "ShiftType"
) -> None:
    """Sonderfall: is_pinned=True + doctor_id=None → SolverShift.is_pinned=False.

    Gepinnte Leere ist keine fixe Zuweisung; Solver darf besetzen.
    """
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=None,
        is_pinned=True,
    )
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    s = schedule.shifts[0]
    assert s.doctor is None
    assert s.is_pinned is False


def test_to_solver_mehrere_shifts_verschiedene_shift_types(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    shift_type_t: "ShiftType",
    doctor_alice: "Doctor",
    doctor_bob: "Doctor",
) -> None:
    """Mehrere Shifts am selben Tag (verschiedene shift_types) → alle korrekt gemappt.

    Nutzt verschiedene ShiftTypes wegen UNIQUE(plan_id, shift_date, shift_type_id).
    """
    s1 = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
        doctor_id=doctor_alice.id,
        is_pinned=True,
    )
    s2 = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_t.id,
        doctor_id=None,
        is_pinned=False,
    )
    db.add_all([s1, s2])
    db.flush()

    schedule = to_solver(db, plan.id)

    assert len(schedule.shifts) == 2
    by_id = {s.id: s for s in schedule.shifts}

    pinned = by_id[s1.id]
    assert pinned.is_pinned is True
    assert pinned.doctor is not None
    assert pinned.doctor.doctor_id == doctor_alice.id

    open_s = by_id[s2.id]
    assert open_s.is_pinned is False
    assert open_s.doctor is None

    # Beide Ärzte im Werte-Bereich
    doctor_ids = {sd.doctor_id for sd in schedule.doctors}
    assert doctor_alice.id in doctor_ids
    assert doctor_bob.id in doctor_ids


def test_to_solver_inaktiver_arzt_nicht_im_wertebereich(
    db: Session, plan: "Plan"
) -> None:
    """Inaktive Ärzte erscheinen nicht im Werte-Bereich."""
    inactive = Doctor(name="Dr. Inaktiv", active=False)
    db.add(inactive)
    db.flush()

    schedule = to_solver(db, plan.id)

    doctor_ids = {sd.doctor_id for sd in schedule.doctors}
    assert inactive.id not in doctor_ids


# ---------------------------------------------------------------------------
# Availability-Snapshot-Tests (M8-003)
# ---------------------------------------------------------------------------


def test_to_solver_leerer_plan_kein_crash(
    db: Session, plan: "Plan", doctor_alice: "Doctor"
) -> None:
    """Plan ohne Shifts → leerer Snapshot pro Arzt, kein Exception."""
    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert alice_solver.unavailable_dates == frozenset()


def test_to_solver_snapshot_leer_fuer_verfuegbaren_arzt(
    db: Session, plan: "Plan", doctor_alice: "Doctor", shift_type_v: "ShiftType"
) -> None:
    """Arzt ohne Abwesenheiten/Exclusions/blockierende Rotation → leeres frozenset."""
    shift_date = date(2026, 6, 2)  # Dienstag
    shift = Shift(
        plan_id=plan.id,
        shift_date=shift_date,
        shift_type_id=shift_type_v.id,
    )
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert alice_solver.unavailable_dates == frozenset()


def test_to_solver_snapshot_enthaelt_absence_datum(
    db: Session, plan: "Plan", doctor_alice: "Doctor", shift_type_v: "ShiftType"
) -> None:
    """Absence über Plan-Datum → Datum in unavailable_dates."""
    shift_date = date(2026, 6, 2)  # Dienstag
    shift = Shift(
        plan_id=plan.id,
        shift_date=shift_date,
        shift_type_id=shift_type_v.id,
    )
    absence = Absence(
        doctor_id=doctor_alice.id,
        absence_type=AbsenceType.URLAUB,
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 5),
    )
    db.add_all([shift, absence])
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert shift_date in alice_solver.unavailable_dates


def test_to_solver_snapshot_enthaelt_rotation_datum(
    db: Session, plan: "Plan", doctor_alice: "Doctor", shift_type_v: "ShiftType"
) -> None:
    """Aktive Rotation auf blockierendem Bereich (Werktag) → Datum in unavailable_dates."""
    shift_date = date(2026, 6, 2)  # Dienstag — Werktag
    shift = Shift(
        plan_id=plan.id,
        shift_date=shift_date,
        shift_type_id=shift_type_v.id,
    )
    dept = Department(
        name="INA-Rotation-Test",
        blocks_ina_weekdays=True,
        blocks_ina_weekends=False,
    )
    db.add_all([shift, dept])
    db.flush()

    rotation = RotationAssignment(
        doctor_id=doctor_alice.id,
        department_id=dept.id,
        plan_id=plan.id,
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
    )
    db.add(rotation)
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert shift_date in alice_solver.unavailable_dates
