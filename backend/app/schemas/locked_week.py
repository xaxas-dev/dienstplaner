from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.schemas.shift import ShiftResponse


class LockedWeekCreate(BaseModel):
    doctor_id: int
    start_date: date
    shift_type_id: int


class LockedWeekResult(BaseModel):
    created: list[ShiftResponse]
    skipped: list[int]
