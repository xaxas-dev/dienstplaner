from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.absence import AbsenceType


class AbsenceBase(BaseModel):
    doctor_id: int
    absence_type: AbsenceType
    valid_from: date
    valid_to: date
    notes: str | None = None


class AbsenceCreate(AbsenceBase): ...


class AbsenceUpdate(BaseModel):
    absence_type: AbsenceType | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    notes: str | None = None


class AbsenceResponse(AbsenceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
