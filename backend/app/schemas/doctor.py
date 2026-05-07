from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.doctor import DoctorType
from app.schemas.employment_period import EmploymentPeriodResponse
from app.schemas.qualification import QualificationResponse


class DoctorBase(BaseModel):
    name: str = Field(max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType = DoctorType.INTERNAL
    is_facharzt: bool = False
    active: bool = True
    entry_date: date | None = None
    virtual_entry_date: date | None = None
    notes: str | None = None


class DoctorCreate(DoctorBase): ...


class DoctorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType | None = None
    is_facharzt: bool | None = None
    active: bool | None = None
    entry_date: date | None = None
    virtual_entry_date: date | None = None
    notes: str | None = None


class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def weiterbildungsjahr(self) -> int | None:
        if self.is_facharzt or self.entry_date is None:
            return None
        delta_days = (date.today() - self.entry_date).days
        if delta_days < 0:
            return None
        return int(delta_days / 365.25) + 1


class DoctorWithRelations(DoctorResponse):
    employment_periods: list[EmploymentPeriodResponse] = []
    qualifications: list[QualificationResponse] = []
