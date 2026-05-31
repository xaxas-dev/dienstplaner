"""Solver-Service: solve_plan und apply_solution.

Kein FastAPI-Import.

solve_plan: Kein DB-Write — gibt nur einen Vorschlags-Diff zurück.
apply_solution: Schreibt Vorschläge in die DB — kein timefold/JVM nötig.

Alle timefold-Importe sind lazy (innerhalb von solve_plan), damit dieses Modul
importierbar ist ohne Java 17+ JVM. Die Phase-A-Invariante bleibt gewahrt:
der FastAPI-App-Start hängt nicht von der JVM ab.

TERMINATION_SECONDS: zentrale Konstante für das Solver-Zeitlimit (Initial: 30s).
Kann per monkeypatch in Tests überschrieben werden.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.repositories import plan_repository as plan_repo
from app.repositories import shift_repository as shift_repo
from app.schemas.solve import ApplyResult, ProposedAssignment, SolveResult
from app.services.exceptions import PlanNotFoundError, ShiftValidationError

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

    from app.solver.constraints import build_constraint_provider
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
            constraint_provider_function=build_constraint_provider(schedule.disabled_constraints),
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


def apply_solution(
    db: Session,
    plan_id: int,
    proposed: list[ProposedAssignment],
) -> ApplyResult:
    """Schreibt Solver-Vorschläge in den Plan. Kein timefold/JVM-Import nötig.

    Weiche Validierung (Phase A): nur Datenkonsistenz wird hart geprüft.
    Gepinnte Shifts werden übersprungen (nicht überschrieben).
    is_pinned wird nicht verändert — Solver-Apply ist nicht manuell.

    Raises:
        PlanNotFoundError: plan_id existiert nicht.
        ShiftValidationError: Shift gehört nicht zu plan_id, oder
            doctor_id verweist auf nicht-existierenden/inaktiven Doctor.
    """
    if plan_repo.get_plan(db, plan_id) is None:
        raise PlanNotFoundError(plan_id)

    applied: list[int] = []
    skipped_pinned: list[int] = []

    for assignment in proposed:
        shift = shift_repo.get_shift(db, assignment.shift_id)

        if shift is None or shift.plan_id != plan_id:
            raise ShiftValidationError(
                f"Schicht mit ID {assignment.shift_id} gehört nicht zu Plan {plan_id}"
            )

        if shift.is_pinned:
            skipped_pinned.append(shift.id)
            continue

        if assignment.doctor_id is not None:
            doctor = db.query(Doctor).filter(Doctor.id == assignment.doctor_id).first()
            if doctor is None:
                raise ShiftValidationError(
                    f"Arzt mit ID {assignment.doctor_id} existiert nicht"
                )
            if not doctor.active:
                raise ShiftValidationError(
                    f"Arzt {doctor.name} ist inaktiv und kann nicht zugewiesen werden"
                )

        shift_repo.update_shift(db, shift.id, {"doctor_id": assignment.doctor_id})
        applied.append(shift.id)

    db.commit()
    return ApplyResult(plan_id=plan_id, applied=applied, skipped_pinned=skipped_pinned)


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
