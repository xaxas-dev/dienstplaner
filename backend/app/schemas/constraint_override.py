from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ConstraintOverrideCreateA(BaseModel):
    level: Literal["A"]
    constraint_id: str
    plan_id: int
    reason: str | None = None


class ConstraintOverrideCreateB(BaseModel):
    level: Literal["B"]
    constraint_id: str
    doctor_id: int
    valid_from: date
    valid_to: date | None = None
    reason: str | None = None


class ConstraintOverrideCreateC(BaseModel):
    level: Literal["C"]
    constraint_id: str
    shift_id: int
    reason: str | None = None


ConstraintOverrideCreate = Annotated[
    ConstraintOverrideCreateA | ConstraintOverrideCreateB | ConstraintOverrideCreateC,
    Field(discriminator="level"),
]


class ConstraintOverrideResponse(BaseModel):
    id: int
    level: str
    constraint_id: str
    plan_id: int | None
    doctor_id: int | None
    shift_id: int | None
    valid_from: date | None
    valid_to: date | None
    reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
