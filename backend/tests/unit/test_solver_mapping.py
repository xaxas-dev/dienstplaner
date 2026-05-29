"""Tests für solver/mapping.py: ORM → Solver-Domäne (Sub-Schritt C + D).

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
    from app.models.employment_period import EmploymentPeriod
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


# ---------------------------------------------------------------------------
# FTE-Snapshot-Tests (M8-004/D)
# ---------------------------------------------------------------------------


def test_to_solver_fte_default_ohne_period(
    db: Session, plan: "Plan", shift_type_v: "ShiftType", doctor_alice: "Doctor"
) -> None:
    """Arzt ohne EmploymentPeriod im Plan-Bereich → fte_percentage == 100 (Fallback)."""
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
    )
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert alice_solver.fte_percentage == 100


def test_to_solver_fte_aus_period(
    db: Session, plan: "Plan", shift_type_v: "ShiftType", doctor_alice: "Doctor"
) -> None:
    """Arzt mit 50%-EmploymentPeriod im Plan-Bereich → fte_percentage == 50."""
    ep = EmploymentPeriod(
        doctor_id=doctor_alice.id,
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        employment_percentage=50,
    )
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
    )
    db.add_all([ep, shift])
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert alice_solver.fte_percentage == 50


def test_to_solver_fair_targets_floor_division(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    doctor_alice: "Doctor",
    doctor_bob: "Doctor",
) -> None:
    """2 Ärzte (100% + 50%), 6 Shifts gleichen Typs → Ziele (4, 2) per Ganzzahl-Division.

    Summe FTE = 150.
    Alice (100%): (6 * 100) // 150 = 4
    Bob   (50%):  (6 *  50) // 150 = 2
    """
    ep_bob = EmploymentPeriod(
        doctor_id=doctor_bob.id,
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        employment_percentage=50,
    )
    db.add(ep_bob)
    # Alice hat keine EmploymentPeriod → Fallback 100%

    for day in range(1, 7):
        db.add(
            Shift(
                plan_id=plan.id,
                shift_date=date(2026, 6, day),
                shift_type_id=shift_type_v.id,
            )
        )
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    bob_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_bob.id)

    assert alice_solver.fair_targets[shift_type_v.id] == 4
    assert bob_solver.fair_targets[shift_type_v.id] == 2


def test_to_solver_fair_targets_pro_shifttype_getrennt(
    db: Session,
    plan: "Plan",
    shift_type_v: "ShiftType",
    shift_type_t: "ShiftType",
    doctor_alice: "Doctor",
    doctor_bob: "Doctor",
) -> None:
    """2 Shift-Typen mit unterschiedlichen Counts → jeder Arzt hat separate Ziele pro Typ."""
    # 4 Shifts Typ V, 2 Shifts Typ T → Gesamtverteilung je nach FTE
    # Alice 100%, Bob 100% → sum_fte=200; Typ V: (4*100)//200=2 je; Typ T: (2*100)//200=1 je
    for day in range(1, 5):
        db.add(
            Shift(
                plan_id=plan.id,
                shift_date=date(2026, 6, day),
                shift_type_id=shift_type_v.id,
            )
        )
    for day in range(5, 7):
        db.add(
            Shift(
                plan_id=plan.id,
                shift_date=date(2026, 6, day),
                shift_type_id=shift_type_t.id,
            )
        )
    db.flush()

    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    bob_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_bob.id)

    # Beide Schlüssel vorhanden
    assert shift_type_v.id in alice_solver.fair_targets
    assert shift_type_t.id in alice_solver.fair_targets
    assert shift_type_v.id in bob_solver.fair_targets
    assert shift_type_t.id in bob_solver.fair_targets

    # Korrekte Werte: (4*100)//200=2, (2*100)//200=1
    assert alice_solver.fair_targets[shift_type_v.id] == 2
    assert alice_solver.fair_targets[shift_type_t.id] == 1
    assert bob_solver.fair_targets[shift_type_v.id] == 2
    assert bob_solver.fair_targets[shift_type_t.id] == 1


def test_to_solver_fair_targets_leer_bei_leerem_plan(
    db: Session, plan: "Plan", doctor_alice: "Doctor"
) -> None:
    """Plan ohne Shifts → fair_targets == {} für jeden Arzt (counts_by_type leer)."""
    schedule = to_solver(db, plan.id)

    alice_solver = next(sd for sd in schedule.doctors if sd.doctor_id == doctor_alice.id)
    assert alice_solver.fair_targets == {}


def test_to_solver_fair_targets_leer_bei_keinem_aktiven_arzt(
    db: Session, plan: "Plan", shift_type_v: "ShiftType"
) -> None:
    """Keine aktiven Ärzte (leerer Werte-Bereich) → kein Crash, leere Doctors-Liste."""
    # Keine Doktoren hinzugefügt → list_doctors liefert [] → sum_fte=0
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 1),
        shift_type_id=shift_type_v.id,
    )
    db.add(shift)
    db.flush()

    # Kein Crash erwartet; Doctors-Liste ist leer
    schedule = to_solver(db, plan.id)

    assert schedule.doctors == []
    assert len(schedule.shifts) == 1


# ---------------------------------------------------------------------------
# BD-Snapshot-Tests (M8-005/D)
# ---------------------------------------------------------------------------


def test_to_solver_shift_is_bd_propagiert(
    db: Session, plan: "Plan", doctor_alice: "Doctor"
) -> None:
    """ShiftType mit is_bereitschaftsdienst=True → SolverShift.is_bereitschaftsdienst=True."""
    st = ShiftType(name="BD-Typ", short_name="BD", display_order=9, active=True,
                   is_bereitschaftsdienst=True)
    db.add(st)
    db.flush()

    shift = Shift(plan_id=plan.id, shift_date=date(2026, 6, 1), shift_type_id=st.id)
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    s = next(sv for sv in schedule.shifts if sv.id == shift.id)
    assert s.is_bereitschaftsdienst is True


def test_to_solver_shift_is_bd_false_default(
    db: Session, plan: "Plan", shift_type_v: "ShiftType", doctor_alice: "Doctor"
) -> None:
    """ShiftType ohne BD-Flag → SolverShift.is_bereitschaftsdienst=False."""
    shift = Shift(plan_id=plan.id, shift_date=date(2026, 6, 1), shift_type_id=shift_type_v.id)
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    s = next(sv for sv in schedule.shifts if sv.id == shift.id)
    assert s.is_bereitschaftsdienst is False


def test_to_solver_shift_type_nicht_in_map_fallback_false(
    db: Session, plan: "Plan", doctor_alice: "Doctor"
) -> None:
    """Inaktiver ShiftType nicht in BD-Map → Fallback False, kein KeyError."""
    st_inactive = ShiftType(
        name="Inaktiv-BD", short_name="IBD", display_order=10, active=False,
        is_bereitschaftsdienst=True,
    )
    db.add(st_inactive)
    db.flush()

    shift = Shift(plan_id=plan.id, shift_date=date(2026, 6, 1), shift_type_id=st_inactive.id)
    db.add(shift)
    db.flush()

    schedule = to_solver(db, plan.id)

    s = next(sv for sv in schedule.shifts if sv.id == shift.id)
    assert s.is_bereitschaftsdienst is False
