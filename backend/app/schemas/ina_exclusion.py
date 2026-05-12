from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.ina_exclusion import INAExclusionReason


class INAExclusionBase(BaseModel):
    valid_from: date
    valid_to: date | None = None
    reason: INAExclusionReason
    notes: str | None = None


class INAExclusionCreate(INAExclusionBase): ...


class INAExclusionUpdate(BaseModel):
    valid_from: date | None = None
    valid_to: date | None = None
    reason: INAExclusionReason | None = None
    notes: str | None = None


class INAExclusionResponse(INAExclusionBase):
    id: int
    doctor_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class INAAvailabilityResponse(BaseModel):
    date: date
    available: bool
    reasons: list[str]
