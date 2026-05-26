"""Solver-Domänenmodell: reine Adapter-Klassen über dem ORM.

ORM-Modelle (Shift, Doctor, Plan) werden NICHT annotiert.
Diese Klassen leben isoliert in solver/, kein SQLAlchemy-Import.

Verifizierte API (timefold==1.24.0b0, empirisch):
  @planning_entity / @planning_solution = Klassen-Dekoratoren
  Felder: Annotated[Type, Annotation()]
  PlanningPin: True = gepinnt (Solver ändert nicht), False = frei
  PlanningVariable(allows_unassigned=True): Variable kann None sein (offener Shift)
"""
from __future__ import annotations

from datetime import date
from typing import Annotated

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
from timefold.solver.score import HardSoftScore


class SolverDoctor:
    """Arzt als problem fact (planning value im Werte-Bereich der Shifts)."""

    def __init__(
        self,
        doctor_id: int,
        name: str,
        *,
        unavailable_dates: frozenset[date] = frozenset(),
        fte_percentage: int = 100,
        fair_targets: dict[int, int] | None = None,
    ) -> None:
        self.doctor_id = doctor_id
        self.name = name
        self.unavailable_dates = unavailable_dates
        self.fte_percentage = fte_percentage
        self.fair_targets = fair_targets if fair_targets is not None else {}

    def __repr__(self) -> str:
        return f"SolverDoctor(id={self.doctor_id}, name={self.name!r})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, SolverDoctor):
            return NotImplemented
        return self.doctor_id == other.doctor_id

    def __hash__(self) -> int:
        return hash(self.doctor_id)


@planning_entity
class SolverShift:
    """Schicht als planning entity.

    Die planning variable `doctor` zeigt auf einen SolverDoctor (oder None = offen).
    `is_pinned=True` entspricht Shift.is_pinned=True im ORM — der Solver darf
    die Variable in diesem Fall nicht verändern (PlanningPin-Semantik).
    Sonderfall: is_pinned=True + doctor=None → nicht-pinnbar; Solver darf besetzen.
    """

    id: Annotated[int, PlanningId]
    # True = gepinnt: PlanningPin sperrt die gesamte Entity für den Solver
    is_pinned: Annotated[bool, PlanningPin]
    # Werte-Bereich kommt vom ValueRangeProvider im ShiftSchedule (SolverDoctor-Liste)
    # allows_unassigned=True: doctor=None ist gültig (offener Shift)
    doctor: Annotated[SolverDoctor | None, PlanningVariable(allows_unassigned=True)]

    # Nicht-variable Felder (problem facts dieser Entity)
    plan_id: int
    shift_date: date
    shift_type_id: int

    def __init__(
        self,
        shift_id: int,
        plan_id: int,
        shift_date: date,
        shift_type_id: int,
        doctor: SolverDoctor | None = None,
        *,
        is_pinned: bool = False,
    ) -> None:
        self.id = shift_id
        self.plan_id = plan_id
        self.shift_date = shift_date
        self.shift_type_id = shift_type_id
        self.doctor = doctor
        # Sonderfall: gepinnt + kein Arzt → nicht pinnbar (Solver darf besetzen)
        self.is_pinned = is_pinned and doctor is not None

    def __repr__(self) -> str:
        return (
            f"SolverShift(id={self.id}, date={self.shift_date}, "
            f"doctor={self.doctor!r}, pinned={self.is_pinned})"
        )


@planning_solution
class ShiftSchedule:
    """Plan-Lösung: enthält alle Schichten (entities) und Ärzte (value range).

    doctors: Werte-Bereich für die doctor-Variable aller SolverShifts.
    shifts:  Planning Entities — Solver weist jedem Shift einen Arzt zu.
    score:   Vom Solver gesetzt nach Constraint-Evaluation.
    """

    doctors: Annotated[list[SolverDoctor], ProblemFactCollectionProperty, ValueRangeProvider]
    shifts: Annotated[list[SolverShift], PlanningEntityCollectionProperty]
    score: Annotated[HardSoftScore, PlanningScore]

    def __init__(self, doctors: list[SolverDoctor], shifts: list[SolverShift]) -> None:
        self.doctors = doctors
        self.shifts = shifts
        self.score = None  # type: ignore[assignment]  # wird vom Solver gesetzt

    def __repr__(self) -> str:
        n_d, n_s = len(self.doctors), len(self.shifts)
        return f"ShiftSchedule(doctors={n_d}, shifts={n_s}, score={self.score})"
