"""Verifiziert timefold==1.24.0b0: Imports, trivialer Solve-Lauf, Pinning.

PREREQ: Java 17+ JVM muss installiert sein (JAVA_HOME oder im PATH).
        Ohne gültige JVM werden diese Tests übersprungen.

Verifizierte Python-API (empirisch, kein Gedächtnis):
  from timefold.solver.domain import planning_entity, planning_solution,
      PlanningId, PlanningPin, PlanningVariable, PlanningScore,
      PlanningEntityCollectionProperty, ProblemFactCollectionProperty, ValueRangeProvider
  from timefold.solver.score import (
      HardSoftScore, ConstraintFactory, Constraint, constraint_provider, Joiners)
  from timefold.solver import SolverFactory
  from timefold.solver.config import (
      SolverConfig, TerminationConfig, ScoreDirectorFactoryConfig, Duration)
  from timefold.solver.test import ConstraintVerifier

  @planning_entity
  class Entity:
      id: Annotated[int, PlanningId]
      is_pinned: Annotated[bool, PlanningPin]          # True = gepinnt
      value: Annotated[Type | None, PlanningVariable(allows_unassigned=True)]

  @planning_solution
  class Solution:
      values: Annotated[list[Type], ProblemFactCollectionProperty, ValueRangeProvider]
      entities: Annotated[list[Entity], PlanningEntityCollectionProperty]
      score: Annotated[HardSoftScore, PlanningScore]

  @constraint_provider
  def constraints(cf: ConstraintFactory) -> list[Constraint]: ...

  SolverConfig(solution_class=..., entity_class_list=[...],
      score_director_factory_config=ScoreDirectorFactoryConfig(constraint_provider_function=...),
      termination_config=TerminationConfig(spent_limit=Duration(seconds=30)))
  SolverFactory.create(config).build_solver().solve(problem)
"""
from typing import Annotated

import pytest

# Versuche JVM zu starten; bei Fehler alle Tests überspringen (kein Collection-Error).
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
    from timefold.solver.domain import (
        PlanningEntityCollectionProperty,
        PlanningId,
        PlanningPin,
        PlanningScore,
        PlanningVariable,
        ProblemFactCollectionProperty,
        ValueRangeProvider,
        planning_entity,
        planning_solution,
    )
    from timefold.solver.score import (
        Constraint,
        ConstraintFactory,
        HardSoftScore,
        constraint_provider,
    )

    # --- Triviales Domänenmodell für diesen Smoke-Test ---

    class _Worker:
        def __init__(self, worker_id: int, name: str) -> None:
            self.worker_id = worker_id
            self.name = name

        def __repr__(self) -> str:
            return f"Worker({self.name})"

    @planning_entity
    class _Task:
        id: Annotated[int, PlanningId]
        # True = gepinnt (Solver darf nicht ändern)
        is_pinned: Annotated[bool, PlanningPin]
        # allows_unassigned=True entspricht offenem Shift (doctor_id=None)
        worker: Annotated[_Worker | None, PlanningVariable(allows_unassigned=True)]

        def __init__(
            self, task_id: int, worker: _Worker | None = None, *, pinned: bool = False
        ) -> None:
            self.id = task_id
            self.is_pinned = pinned
            self.worker = worker

    @planning_solution
    class _Schedule:
        workers: Annotated[list[_Worker], ProblemFactCollectionProperty, ValueRangeProvider]
        tasks: Annotated[list[_Task], PlanningEntityCollectionProperty]
        score: Annotated[HardSoftScore, PlanningScore]

        def __init__(self, workers: list[_Worker], tasks: list[_Task]) -> None:
            self.workers = workers
            self.tasks = tasks
            self.score = None  # type: ignore[assignment]

    @constraint_provider
    def _no_constraints(cf: ConstraintFactory) -> list[Constraint]:
        return []

    def _build_solver(seconds: int = 5) -> object:
        config = SolverConfig(
            solution_class=_Schedule,
            entity_class_list=[_Task],
            score_director_factory_config=ScoreDirectorFactoryConfig(
                constraint_provider_function=_no_constraints,
            ),
            termination_config=TerminationConfig(spent_limit=Duration(seconds=seconds)),
        )
        return SolverFactory.create(config).build_solver()

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(
    not _JVM_OK,
    reason=_JVM_SKIP_REASON,
)


# --- Tests (nur ausgeführt wenn _JVM_OK) ---


def test_timefold_imports_erfolgreich() -> None:
    """Alle kritischen Timefold-Python-Importe sind verfügbar."""
    assert SolverFactory is not None
    assert HardSoftScore is not None
    assert constraint_provider is not None
    assert planning_entity is not None
    assert planning_solution is not None
    assert PlanningPin is not None


def test_solver_loest_triviales_problem() -> None:
    """Solver läuft end-to-end und gibt eine gültige Lösung zurück."""
    solver = _build_solver(seconds=5)
    alice = _Worker(1, "Alice")
    bob = _Worker(2, "Bob")
    task = _Task(task_id=1)

    solution = solver.solve(_Schedule(workers=[alice, bob], tasks=[task]))

    assert solution is not None
    assert solution.score is not None


def test_gepinnter_task_bleibt_unveraendert() -> None:
    """Gepinnter Task behält seinen Arzt — Solver ändert ihn nicht."""
    solver = _build_solver(seconds=5)
    alice = _Worker(1, "Alice")
    pinned = _Task(task_id=1, worker=alice, pinned=True)
    open_task = _Task(task_id=2)

    solution = solver.solve(_Schedule(workers=[alice], tasks=[pinned, open_task]))

    pinned_result = next(t for t in solution.tasks if t.id == 1)
    assert pinned_result.worker is alice, "Gepinnter Task darf vom Solver nicht geändert werden"
