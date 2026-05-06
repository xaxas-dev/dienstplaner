from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class ShiftTypeBase(BaseModel):
    name: str = Field(max_length=100)
    short_name: str = Field(max_length=20)
    applies_on_weekdays: bool = True
    applies_on_weekend: bool = False
    start_time: time | None = None
    end_time: time | None = None
    display_order: int = 0
    active: bool = True
    notes: str | None = None


class ShiftTypeCreate(ShiftTypeBase): ...


class ShiftTypeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    short_name: str | None = Field(default=None, max_length=20)
    applies_on_weekdays: bool | None = None
    applies_on_weekend: bool | None = None
    start_time: time | None = None
    end_time: time | None = None
    display_order: int | None = None
    active: bool | None = None
    notes: str | None = None


class ShiftTypeResponse(ShiftTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
