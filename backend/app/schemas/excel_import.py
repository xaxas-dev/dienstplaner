"""Pydantic v2 DTOs für den Besetzungsplan-Excel-Import (Phase A, read-only)."""

from __future__ import annotations

import enum
from datetime import date

from pydantic import BaseModel


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
