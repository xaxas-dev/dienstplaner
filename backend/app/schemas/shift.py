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
    # Alle Felder optional. Im Service MUSS model_dump(exclude_unset=True) verwendet werden:
    # - Feld fehlt im Request → unverändert lassen
    # - Feld explizit auf None → doctor_id wird gelöscht (Zuweisung aufheben)
    doctor_id: int | None = None
    is_pinned: bool | None = None
    notes: str | None = None

    model_config = ConfigDict(extra="forbid")


class ShiftResponse(ShiftBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShiftWithDetails(ShiftResponse):
    shift_type: ShiftTypeResponse | None = None
    doctor: DoctorResponse | None = None
