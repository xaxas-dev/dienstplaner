"""Schemas für Solver-Vorschlag (SolveResult) und Apply-Endpoint."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ProposedAssignment(BaseModel):
    shift_id: int
    doctor_id: int | None


class SolveResult(BaseModel):
    plan_id: int
    proposed_assignments: list[ProposedAssignment]
    hard_score: int
    soft_score: int
    feasible: bool


class ApplyRequest(BaseModel):
    proposed_assignments: list[ProposedAssignment]
    model_config = ConfigDict(extra="forbid")


class ApplyResult(BaseModel):
    plan_id: int
    applied: list[int]  # shift_ids, die geschrieben wurden
    skipped_pinned: list[int]  # shift_ids, die wegen is_pinned übersprungen wurden
