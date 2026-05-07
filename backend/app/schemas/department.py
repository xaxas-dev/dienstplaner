from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentBase(BaseModel):
    name: str = Field(max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    is_external: bool = False
    is_shift_relevant: bool = True
    active: bool = True
    display_order: int = 0
    requires_full_time: bool = False
    min_headcount: int | None = None
    max_headcount: int | None = None
    notes: str | None = None


class DepartmentCreate(DepartmentBase): ...


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    is_external: bool | None = None
    is_shift_relevant: bool | None = None
    active: bool | None = None
    display_order: int | None = None
    requires_full_time: bool | None = None
    min_headcount: int | None = None
    max_headcount: int | None = None
    notes: str | None = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
