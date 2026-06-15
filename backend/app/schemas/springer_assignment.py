from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.department import DepartmentResponse


class SpringerAssignmentCreate(BaseModel):
    shift_date: date
    doctor_id: int
    target_department_id: int
    notes: str | None = None


class SpringerAssignmentResponse(BaseModel):
    id: int
    plan_id: int
    shift_date: date
    doctor_id: int
    target_department_id: int
    target_department: DepartmentResponse
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
