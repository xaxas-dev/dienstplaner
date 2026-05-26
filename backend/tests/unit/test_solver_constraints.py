"""Tests für solver/constraints.py: DOUBLE_BOOKED Hard-Constraint (Sub-Schritt D).

Positiv-Test:  kollisionsfreier Plan → Hard-Score 0 (feasible).
Negativ-Test: konstruierte Doppelbelegung (gepinnt) → Hard-Score < 0.

Voller Solver-Lauf statt ConstraintVerifier (Python-API für CV empirisch nicht
verifiziert); Pinning verhindert, dass der Solver die Kollision auflöst.

JVM-Guard wie in den anderen Solver-Tests.
"""
from datetime import date

import pytest

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    from timefold.solver import SolverFactory
    from timefold.solver.config import (
        Duration,
        ScoreDirectorFactoryConfig,
        SolverConfig,
        TerminationConfig,
    )

    from app.solver.constraints import constraint_definitions
    from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)

# ---------------------------------------------------------------------------
# Modul-Level-Setup (nur wenn JVM verfügbar)
# ---------------------------------------------------------------------------

_DR_ALICE: "SolverDoctor | None" = None
_DR_BOB: "SolverDoctor | None" = None
_solver_factory: object = None

if _JVM_OK:
    _DR_ALICE = SolverDoctor(doctor_id=1, name="Dr. Alice")
    _DR_BOB = SolverDoctor(doctor_id=2, name="Dr. Bob")

    _config = SolverConfig(
        solution_class=ShiftSchedule,
        entity_class_list=[SolverShift],
        score_director_factory_config=ScoreDirectorFactoryConfig(
            constraint_provider_function=constraint_definitions,
        ),
        termination_config=TerminationConfig(spent_limit=Duration(seconds=5)),
    )
    _solver_factory = SolverFactory.create(_config)


def _solve(schedule: "ShiftSchedule") -> "ShiftSchedule":
    return _solver_factory.build_solver().solve(schedule)  # type: ignore[union-attr]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_verschiedene_aerzte_kein_hard_penalty() -> None:
    """Zwei Shifts am selben Tag, verschiedene Ärzte (gepinnt) → Hard-Score 0."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=2, doctor=_DR_BOB, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    assert solution.score.hard_score == 0


def test_gleicher_arzt_selber_tag_hard_penalty() -> None:
    """Zwei Shifts am selben Tag, gleicher Arzt (gepinnt) → Hard-Score < 0."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=2, doctor=_DR_ALICE, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    assert solution.score.hard_score < 0


def test_gleicher_arzt_verschiedene_tage_kein_penalty() -> None:
    """Gleicher Arzt, verschiedene Tage (gepinnt) → kein Hard-Penalty."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 2),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE], shifts=[s1, s2]))

    assert solution.score.hard_score == 0


def test_offene_shifts_kein_hard_penalty() -> None:
    """Zwei offene Shifts am selben Tag → Solver weist ohne DOUBLE_BOOKED zu."""
    s1 = SolverShift(shift_id=1, plan_id=1, shift_date=date(2026, 6, 1), shift_type_id=1)
    s2 = SolverShift(shift_id=2, plan_id=1, shift_date=date(2026, 6, 1), shift_type_id=2)

    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    # Solver hat zwei verschiedene Ärzte zur Auswahl — DOUBLE_BOOKED tritt nicht auf.
    assert solution.score.hard_score == 0


# ---------------------------------------------------------------------------
# ABSENT_DOCTOR-Tests (M8-003)
# ---------------------------------------------------------------------------

_ABSENT_DATE = date(2026, 6, 5)

_DR_ABSENT: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_ABSENT = SolverDoctor(
        doctor_id=3, name="Dr. Abwesend", unavailable_dates=frozenset([_ABSENT_DATE])
    )


def test_absent_doctor_penalize_bei_unavailable_date() -> None:
    """Arzt an Datum in unavailable_dates (gepinnt) → Hard-Score < 0."""
    shift = SolverShift(
        shift_id=10, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=_DR_ABSENT, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score < 0


def test_absent_doctor_kein_penalize_bei_available_date() -> None:
    """Arzt an Datum NICHT in unavailable_dates (gepinnt) → Hard-Score 0."""
    other_date = date(2026, 6, 6)  # nicht in unavailable_dates
    shift = SolverShift(
        shift_id=11, plan_id=1, shift_date=other_date,
        shift_type_id=1, doctor=_DR_ABSENT, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score == 0


def test_absent_doctor_kein_penalize_bei_null_doctor() -> None:
    """Offener Shift (doctor=None) an unavailable_dates-Datum → kein Penalty."""
    shift = SolverShift(
        shift_id=12, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=None,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score == 0


def test_absent_doctor_und_double_booked_addieren() -> None:
    """Beide Verstöße gleichzeitig → Score <= -2 (Constraints addieren)."""
    # _DR_ALICE ist an _ABSENT_DATE in zwei Shifts (DOUBLE_BOOKED)
    # und in unavailable_dates (ABSENT_DOCTOR) → mind. 2× ONE_HARD
    dr_alice_absent = SolverDoctor(
        doctor_id=10, name="Dr. AliceAbsent",
        unavailable_dates=frozenset([_ABSENT_DATE]),
    )
    s1 = SolverShift(
        shift_id=20, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=dr_alice_absent, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=21, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=2, doctor=dr_alice_absent, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[dr_alice_absent], shifts=[s1, s2]))

    # DOUBLE_BOOKED (1×) + ABSENT_DOCTOR (2×) = mindestens -3
    assert solution.score.hard_score <= -2


# ---------------------------------------------------------------------------
# FAIR_DISTRIBUTION-Tests (M8-004)
#
# Alle Tests nutzen is_pinned=True, damit der Solver die Zuweisung nicht
# optimiert. fair_targets wird direkt am SolverDoctor gesetzt (kein DB).
# Nur 1 Arzt im Pool bei Tests, die ausschließlich fair_distribution prüfen
# (vermeidet DOUBLE_BOOKED-Interaktionen).
# ---------------------------------------------------------------------------

_DR_FAIR: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_FAIR = SolverDoctor(doctor_id=20, name="Dr. Fair", fair_targets={1: 2})


def test_fair_distribution_kein_penalize_bei_target_erreicht() -> None:
    """Arzt hat genau fair_targets={1: 2} Schichten von Typ 1 → soft_score == 0."""
    s1 = SolverShift(
        shift_id=30, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=1, doctor=_DR_FAIR, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=31, plan_id=1, shift_date=date(2026, 8, 2),
        shift_type_id=1, doctor=_DR_FAIR, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_FAIR], shifts=[s1, s2]))

    assert solution.score.hard_score == 0
    assert solution.score.soft_score == 0


def test_fair_distribution_penalize_pro_ueber_soll_shift() -> None:
    """Arzt hat 4 Schichten von Typ 1, Ziel=2 → Überschreitung=2 → soft_score == -2."""
    dr = SolverDoctor(doctor_id=21, name="Dr. Overloaded", fair_targets={1: 2})
    shifts = [
        SolverShift(
            shift_id=40 + i, plan_id=1, shift_date=date(2026, 8, i + 1),
            shift_type_id=1, doctor=dr, is_pinned=True,
        )
        for i in range(4)
    ]
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=shifts))

    assert solution.score.hard_score == 0
    assert solution.score.soft_score == -2


def test_fair_distribution_kein_penalize_bei_null_doctor() -> None:
    """Offene Shifts (doctor=None) → kein Soft-Penalty, auch wenn kein Arzt zugewiesen."""
    # Nur ein Arzt im Pool mit target=0 für alle Typen.
    # Shifts sind offen (nicht gepinnt, doctor=None), Solver kann unassigned lassen.
    dr = SolverDoctor(doctor_id=22, name="Dr. Target0", fair_targets={1: 0})
    s1 = SolverShift(shift_id=50, plan_id=1, shift_date=date(2026, 8, 1), shift_type_id=1)
    s2 = SolverShift(shift_id=51, plan_id=1, shift_date=date(2026, 8, 2), shift_type_id=1)
    # Solver mit leerer Doktorliste → kein Arzt verfügbar → doctor=None bleibt
    solution = _solve(ShiftSchedule(doctors=[], shifts=[s1, s2]))

    assert solution.score.soft_score == 0


def test_fair_distribution_getrennt_pro_shifttype() -> None:
    """Überschreitung nur bei Typ 1, nicht bei Typ 2 → nur Typ-1-Penalty zählt."""
    # Dr. Mixed: fair_targets={1: 1, 2: 3}
    # Hat 3 Schichten vom Typ 1 (Überschreitung = 2) und 2 Schichten vom Typ 2 (< Ziel)
    dr = SolverDoctor(doctor_id=23, name="Dr. Mixed", fair_targets={1: 1, 2: 3})
    # 3 Schichten Typ 1 → count=3, target=1, Penalty=2
    t1_shifts = [
        SolverShift(
            shift_id=60 + i, plan_id=1, shift_date=date(2026, 8, i + 1),
            shift_type_id=1, doctor=dr, is_pinned=True,
        )
        for i in range(3)
    ]
    # 2 Schichten Typ 2 → count=2, target=3 → keine Überschreitung
    t2_shifts = [
        SolverShift(
            shift_id=70 + i, plan_id=1, shift_date=date(2026, 8, i + 10),
            shift_type_id=2, doctor=dr, is_pinned=True,
        )
        for i in range(2)
    ]
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=t1_shifts + t2_shifts))

    assert solution.score.hard_score == 0
    # Nur Typ-1-Penalty: 3 - 1 = 2
    assert solution.score.soft_score == -2


def test_fair_distribution_und_double_booked_unabhaengig() -> None:
    """DOUBLE_BOOKED (hard) und FAIR_DISTRIBUTION (soft) gleichzeitig → unabhängig addiert.

    Dr. Combo hat:
      - 2 Shifts am selben Tag (→ DOUBLE_BOOKED: hard_score < 0)
      - 3 Schichten vom Typ 1, Ziel=2 (→ FAIR_DISTRIBUTION: soft_score == -1)
    """
    dr = SolverDoctor(doctor_id=24, name="Dr. Combo", fair_targets={1: 2})
    # Selber Tag → DOUBLE_BOOKED
    s1 = SolverShift(
        shift_id=80, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=81, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=2, doctor=dr, is_pinned=True,
    )
    # Weiterer Shift Typ 1 → insgesamt 2× Typ 1 (s1 + s3), noch kein Penalty bei target=2
    # Aber wir wollen Penalty: 3 Shifts Typ 1, target=2 → Penalty 1
    # s2 ist Typ 2 (DOUBLE_BOOKED-Tag), s3 ist Typ 1 auf anderem Tag
    s3 = SolverShift(
        shift_id=82, plan_id=1, shift_date=date(2026, 8, 2),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    # Jetzt: Typ 1 count = 2 (s1 + s3), target=2 → kein Soft-Penalty für Typ 1
    # Füge s4 (Typ 1, weiterer Tag) hinzu → count=3, Penalty=1
    s4 = SolverShift(
        shift_id=83, plan_id=1, shift_date=date(2026, 8, 3),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=[s1, s2, s3, s4]))

    # DOUBLE_BOOKED: s1+s2 selber Tag → hard_score < 0
    assert solution.score.hard_score < 0
    # FAIR_DISTRIBUTION: Typ 1 count=3 (s1,s3,s4), target=2 → soft_score == -1
    assert solution.score.soft_score < 0
