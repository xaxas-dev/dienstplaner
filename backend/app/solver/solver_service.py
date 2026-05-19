"""Solver-Service: solve_plan(db, plan_id) → SolveResult.

Kein FastAPI-Import. Kein DB-Write — gibt nur einen Vorschlags-Diff zurück.

Alle timefold-Importe sind lazy (innerhalb von solve_plan), damit dieses Modul
importierbar ist ohne Java 17+ JVM. Die Phase-A-Invariante bleibt gewahrt:
der FastAPI-App-Start hängt nicht von der JVM ab.

TERMINATION_SECONDS: zentrale Konstante für das Solver-Zeitlimit (Initial: 30s).
Kann per monkeypatch in Tests überschrieben werden.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.schemas.solve import ProposedAssignment, SolveResult

if TYPE_CHECKING:
    from app.solver.domain import SolverShift

TERMINATION_SECONDS: int = 30


def solve_plan(db: Session, plan_id: int) -> SolveResult:
    """Löst einen Plan, gibt Vorschlags-Diff zurück — kein DB-Write.

    Startet die JVM beim ersten Aufruf (lazy timefold-Imports).
    """
    # Lazy imports: JVM startet erst hier, nicht beim Modulimport
    from timefold.solver import SolverFactory
    from timefold.solver.config import (
        Duration,
        ScoreDirectorFactoryConfig,
        SolverConfig,
        TerminationConfig,
    )

    from app.solver.constraints import constraint_definitions
    from app.solver.domain import ShiftSchedule, SolverShift
    from app.solver.mapping import to_solver

    schedule = to_solver(db, plan_id)

    # Vor-Zustand für Diff-Berechnung sichern (Solver verändert Felder in-place)
    original: dict[int, int | None] = {
        s.id: (s.doctor.doctor_id if s.doctor else None) for s in schedule.shifts
    }

    config = SolverConfig(
        solution_class=ShiftSchedule,
        entity_class_list=[SolverShift],
        score_director_factory_config=ScoreDirectorFactoryConfig(
            constraint_provider_function=constraint_definitions,
        ),
        termination_config=TerminationConfig(spent_limit=Duration(seconds=TERMINATION_SECONDS)),
    )
    solution = SolverFactory.create(config).build_solver().solve(schedule)

    return SolveResult(
        plan_id=plan_id,
        proposed_assignments=_compute_diff(solution.shifts, original),
        hard_score=solution.score.hard_score,
        soft_score=solution.score.soft_score,
        feasible=solution.score.hard_score >= 0,
    )


def _compute_diff(
    solved_shifts: list[SolverShift],
    original: dict[int, int | None],
) -> list[ProposedAssignment]:
    """Gibt Shifts zurück, bei denen der Solver die Zuweisung geändert hat.

    Gepinnte Shifts werden ausgelassen — Solver hat sie nicht verändert.
    """
    result: list[ProposedAssignment] = []
    for shift in solved_shifts:
        if shift.is_pinned:
            continue
        proposed_doctor_id = shift.doctor.doctor_id if shift.doctor else None
        if proposed_doctor_id != original[shift.id]:
            result.append(ProposedAssignment(shift_id=shift.id, doctor_id=proposed_doctor_id))
    return result
