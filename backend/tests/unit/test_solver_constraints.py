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
