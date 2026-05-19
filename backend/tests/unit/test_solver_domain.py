"""Tests für das Solver-Domänenmodell (Sub-Schritt B).

Kein Solver-Lauf — nur Instanziierung, Feld-Semantik, Pin-Logik.
Kein JVM-Zugriff beim Import (Annotations werden lazy durch @planning_entity geladen),
daher kein Skip-Guard nötig sofern timefold importierbar ist.

Da @planning_entity die JVM beim Import startet: Tests überspringen wenn kein Java 17+.
"""
from datetime import date

import pytest

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)


# --- SolverDoctor ---


def test_solver_doctor_instanziierung() -> None:
    d = SolverDoctor(doctor_id=1, name="Dr. Müller")
    assert d.doctor_id == 1
    assert d.name == "Dr. Müller"


def test_solver_doctor_gleichheit() -> None:
    a = SolverDoctor(1, "Alice")
    b = SolverDoctor(1, "Alice (Kopie)")
    c = SolverDoctor(2, "Bob")
    assert a == b
    assert a != c
    assert hash(a) == hash(b)


# --- SolverShift ---


def test_solver_shift_offen() -> None:
    """Offener Shift: kein Arzt, nicht gepinnt."""
    s = SolverShift(
        shift_id=10,
        plan_id=1,
        shift_date=date(2025, 6, 1),
        shift_type_id=2,
    )
    assert s.id == 10
    assert s.doctor is None
    assert s.is_pinned is False


def test_solver_shift_gepinnt_mit_arzt() -> None:
    """Gepinnter Shift: Arzt wird beibehalten, is_pinned=True."""
    dr = SolverDoctor(5, "Dr. Weber")
    s = SolverShift(
        shift_id=20,
        plan_id=1,
        shift_date=date(2025, 6, 2),
        shift_type_id=3,
        doctor=dr,
        is_pinned=True,
    )
    assert s.doctor is dr
    assert s.is_pinned is True


def test_solver_shift_gepinnt_ohne_arzt_nicht_pinnbar() -> None:
    """Sonderfall: is_pinned=True ohne Arzt → nicht wirklich gepinnt.

    Gepinnte Leere-Zellen sind keine fixe Zuweisung;
    der Solver darf diese Schicht besetzen.
    """
    s = SolverShift(
        shift_id=30,
        plan_id=1,
        shift_date=date(2025, 6, 3),
        shift_type_id=1,
        doctor=None,
        is_pinned=True,  # wird ignoriert, da kein Arzt
    )
    assert s.doctor is None
    assert s.is_pinned is False  # Sonderfall: nicht-pinnbar


# --- ShiftSchedule ---


def test_shift_schedule_instanziierung() -> None:
    doctors = [SolverDoctor(1, "Alice"), SolverDoctor(2, "Bob")]
    shifts = [
        SolverShift(shift_id=1, plan_id=1, shift_date=date(2025, 6, 1), shift_type_id=1),
        SolverShift(shift_id=2, plan_id=1, shift_date=date(2025, 6, 1), shift_type_id=2),
    ]
    schedule = ShiftSchedule(doctors=doctors, shifts=shifts)
    assert len(schedule.doctors) == 2
    assert len(schedule.shifts) == 2
    assert schedule.score is None
