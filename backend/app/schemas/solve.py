"""SolveResult-Schema: Vorschlags-Diff vom Solver (kein DB-Write)."""
from __future__ import annotations

from pydantic import BaseModel


class ProposedAssignment(BaseModel):
    shift_id: int
    doctor_id: int | None


class SolveResult(BaseModel):
    plan_id: int
    proposed_assignments: list[ProposedAssignment]
    hard_score: int
    soft_score: int
    feasible: bool
