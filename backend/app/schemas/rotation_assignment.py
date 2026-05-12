from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.department import DepartmentResponse
from app.schemas.doctor import DoctorResponse


class RotationAssignmentBase(BaseModel):
    plan_id: int
    doctor_id: int
    department_id: int
    valid_from: date
    valid_to: date
    is_einarbeitung: bool = False
    notes: str | None = None


class RotationAssignmentCreate(RotationAssignmentBase): ...


class RotationAssignmentUpdate(BaseModel):
    doctor_id: int | None = None
    department_id: int | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    is_einarbeitung: bool | None = None
    notes: str | None = None


class RotationAssignmentResponse(RotationAssignmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RotationAssignmentWithDetails(RotationAssignmentResponse):
    doctor: DoctorResponse | None = None
    department: DepartmentResponse | None = None
