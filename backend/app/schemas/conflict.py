from __future__ import annotations

import enum
from datetime import date

from pydantic import BaseModel


class ConflictType(enum.StrEnum):
    NOT_AVAILABLE = "not_available"
    DOUBLE_BOOKED = "double_booked"


class ShiftConflict(BaseModel):
    shift_id: int
    conflict_type: ConflictType
    message: str
    doctor_id: int
    doctor_name: str
    shift_date: date
    shift_type_short_name: str


class OpenShift(BaseModel):
    shift_id: int | None
    shift_date: date
    shift_type_short_name: str


class PlanConflicts(BaseModel):
    plan_id: int
    conflicts: list[ShiftConflict]
    conflict_count: int
    open_shifts: list[OpenShift]
    open_shift_count: int
