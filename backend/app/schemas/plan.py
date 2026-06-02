from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.plan import PlanStatus
from app.schemas.rotation_assignment import RotationAssignmentResponse
from app.schemas.shift import ShiftResponse


class PlanBase(BaseModel):
    name: str = Field(max_length=200, min_length=1)
    valid_from: date
    valid_to: date
    status: PlanStatus = PlanStatus.DRAFT
    notes: str | None = None
    besetzung_locked: bool = False


class PlanCreate(PlanBase):
    shift_type_ids: list[int] | None = None


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200, min_length=1)
    valid_from: date | None = None
    valid_to: date | None = None
    status: PlanStatus | None = None
    notes: str | None = None
    besetzung_locked: bool | None = None


class PlanClone(BaseModel):
    name: str = Field(max_length=200, min_length=1)
    valid_from: date
    valid_to: date
    notes: str | None = None


class PlanResponse(PlanBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlanWithRelations(PlanResponse):
    shifts: list[ShiftResponse] = []
    rotation_assignments: list[RotationAssignmentResponse] = []


class CloneResult(BaseModel):
    plan: PlanWithRelations
    rotations_copied: int
    rotations_skipped: int
