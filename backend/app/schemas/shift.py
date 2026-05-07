from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.doctor import DoctorResponse
from app.schemas.shift_type import ShiftTypeResponse


class ShiftBase(BaseModel):
    plan_id: int
    shift_date: date
    shift_type_id: int
    doctor_id: int | None = None
    is_pinned: bool = False
    notes: str | None = None


class ShiftCreate(ShiftBase): ...


class ShiftUpdate(BaseModel):
    shift_date: date | None = None
    shift_type_id: int | None = None
    doctor_id: int | None = None
    is_pinned: bool | None = None
    notes: str | None = None


class ShiftResponse(ShiftBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShiftWithDetails(ShiftResponse):
    shift_type: ShiftTypeResponse | None = None
    doctor: DoctorResponse | None = None
