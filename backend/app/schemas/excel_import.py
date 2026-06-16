"""Pydantic v2 DTOs für den Besetzungsplan-Excel-Import (Phase A, read-only)."""

from __future__ import annotations

import enum
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class MatchStatus(enum.StrEnum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    NEW = "new"
    UNMATCHED = "unmatched"


class EntityDefaultAction(enum.StrEnum):
    MAP = "map"
    CREATE = "create"
    SKIP = "skip"


class CodeDefaultAction(enum.StrEnum):
    ABSENCE = "absence"
    SHIFT = "shift"
    SPRINGER = "springer"
    IGNORE = "ignore"
    UNMATCHED = "unmatched"


class MatchCandidate(BaseModel):
    id: int
    name: str
    score: float


class DepartmentMatch(BaseModel):
    raw: str
    match_status: MatchStatus
    matched_id: int | None
    candidates: list[MatchCandidate]
    default_action: EntityDefaultAction


class DoctorMatch(BaseModel):
    raw: str
    match_status: MatchStatus
    matched_id: int | None
    candidates: list[MatchCandidate]
    default_action: EntityDefaultAction
    parsed_name: str
    percentage: int | None


class CodeEntry(BaseModel):
    raw: str
    default_action: CodeDefaultAction
    absence_type: str | None
    shift_type_id: int | None
    shift_type_short_name: str | None
    department_id: int | None = None
    department_short_name: str | None = None
    default_note: str | None = None


class ImportMonth(BaseModel):
    sheet_name: str
    year: int
    month: int
    valid_from: date
    valid_to: date


class ImportAnalysis(BaseModel):
    month: ImportMonth
    departments: list[DepartmentMatch]
    doctors: list[DoctorMatch]
    codes: list[CodeEntry]
    warnings: list[str]


# ---------------------------------------------------------------------------
# Commit-DTOs (Phase C): Eingabe der bestätigten Reconciliation + Ergebnis.
# ---------------------------------------------------------------------------


# --- Ziel-Plan ---
class TargetPlanNew(BaseModel):
    mode: Literal["new"]
    name: str
    valid_from: date
    valid_to: date


class TargetPlanExisting(BaseModel):
    mode: Literal["existing"]
    plan_id: int


TargetPlan = Annotated[TargetPlanNew | TargetPlanExisting, Field(discriminator="mode")]


# --- Bereichs-Auflösungen ---
class DeptResolutionMap(BaseModel):
    action: Literal["map"]
    id: int


class DeptResolutionCreate(BaseModel):
    action: Literal["create"]


class DeptResolutionSkip(BaseModel):
    action: Literal["skip"]


DepartmentResolution = Annotated[
    DeptResolutionMap | DeptResolutionCreate | DeptResolutionSkip,
    Field(discriminator="action"),
]


# --- Arzt-Auflösungen ---
class DoctorResolutionMap(BaseModel):
    action: Literal["map"]
    id: int
    percentage: int | None = None


class DoctorResolutionCreate(BaseModel):
    action: Literal["create"]
    percentage: int | None = None


class DoctorResolutionSkip(BaseModel):
    action: Literal["skip"]


DoctorResolution = Annotated[
    DoctorResolutionMap | DoctorResolutionCreate | DoctorResolutionSkip,
    Field(discriminator="action"),
]


# --- Code-Auflösungen (Phase D) ---
class CodeResolutionAbsence(BaseModel):
    action: Literal["absence"]
    absence_type: str  # AbsenceType enum value, e.g. "URLAUB"


class CodeResolutionShift(BaseModel):
    action: Literal["shift"]
    shift_type_id: int


class CodeResolutionCreateShift(BaseModel):
    action: Literal["create_shift"]
    short_name: str
    name: str


class CodeResolutionSpringer(BaseModel):
    action: Literal["springer"]
    department_id: int


class CodeResolutionIgnore(BaseModel):
    action: Literal["ignore"]


CodeResolution = Annotated[
    CodeResolutionAbsence
    | CodeResolutionShift
    | CodeResolutionCreateShift
    | CodeResolutionSpringer
    | CodeResolutionIgnore,
    Field(discriminator="action"),
]


class CommitResolutions(BaseModel):
    target_plan: TargetPlan
    department_resolutions: dict[str, DepartmentResolution]
    doctor_resolutions: dict[str, DoctorResolution]
    code_resolutions: dict[str, CodeResolution]


# --- Ergebnis ---
class ImportResult(BaseModel):
    plan_id: int
    plan_name: str
    created_departments: int
    created_doctors: int
    created_employment_periods: int
    created_rotations: int
    created_absences: int = 0
    created_shifts: int = 0
    created_springer_assignments: int = 0
    warnings: list[str]
