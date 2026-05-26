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


# --- SolverDoctor.unavailable_dates (M8-003) ---


def test_solver_doctor_default_unavailable_dates_leer() -> None:
    d = SolverDoctor(doctor_id=1, name="Dr. Müller")
    assert d.unavailable_dates == frozenset()


def test_solver_doctor_unavailable_dates_konfigurierbar() -> None:
    dates = frozenset([date(2025, 6, 5), date(2025, 6, 10)])
    d = SolverDoctor(doctor_id=2, name="Dr. Weber", unavailable_dates=dates)
    assert d.unavailable_dates == dates
    assert date(2025, 6, 5) in d.unavailable_dates


def test_solver_doctor_eq_ignoriert_unavailable_dates() -> None:
    """Identität basiert nur auf doctor_id, nicht auf Snapshot-Inhalt."""
    a = SolverDoctor(1, "Alice")
    b = SolverDoctor(1, "Alice", unavailable_dates=frozenset([date(2025, 6, 1)]))
    assert a == b
    assert hash(a) == hash(b)


# --- SolverDoctor.fte_percentage + fair_targets (M8-004/B) ---


def test_solver_doctor_default_fte_100() -> None:
    d = SolverDoctor(doctor_id=1, name="Dr. Müller")
    assert d.fte_percentage == 100


def test_solver_doctor_default_fair_targets_leer() -> None:
    """Zwei separate Instanzen bekommen eigene leere Dicts (nicht geteilt)."""
    a = SolverDoctor(doctor_id=1, name="Alice")
    b = SolverDoctor(doctor_id=2, name="Bob")
    assert a.fair_targets == {}
    assert b.fair_targets == {}
    assert a.fair_targets is not b.fair_targets


def test_solver_doctor_fte_konfigurierbar() -> None:
    d = SolverDoctor(doctor_id=3, name="Dr. Teilzeit", fte_percentage=50)
    assert d.fte_percentage == 50


def test_solver_doctor_fair_targets_konfigurierbar() -> None:
    targets = {1: 3, 2: 1}
    d = SolverDoctor(doctor_id=4, name="Dr. Weber", fair_targets=targets)
    assert d.fair_targets == {1: 3, 2: 1}


def test_solver_doctor_eq_ignoriert_neue_felder() -> None:
    """Gleichheit basiert nur auf doctor_id — fte_percentage und fair_targets spielen keine Rolle."""
    a = SolverDoctor(doctor_id=1, name="Alice", fte_percentage=100, fair_targets={1: 3})
    b = SolverDoctor(doctor_id=1, name="Alice", fte_percentage=50, fair_targets={2: 7})
    assert a == b
    assert hash(a) == hash(b)


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
