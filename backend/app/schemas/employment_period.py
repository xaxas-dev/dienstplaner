from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EmploymentPeriodBase(BaseModel):
    doctor_id: int
    valid_from: date
    valid_to: date | None = None
    employment_percentage: int = Field(ge=1, le=100)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "EmploymentPeriodBase":
        if self.valid_to is not None and self.valid_from >= self.valid_to:
            raise ValueError("valid_from muss vor valid_to liegen")
        return self


class EmploymentPeriodCreate(EmploymentPeriodBase): ...


class EmploymentPeriodUpdate(BaseModel):
    valid_from: date | None = None
    valid_to: date | None = None
    employment_percentage: int | None = Field(default=None, ge=1, le=100)
    notes: str | None = None


class EmploymentPeriodResponse(EmploymentPeriodBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmploymentPeriodBody(BaseModel):
    """Request-Body für POST/PATCH wenn doctor_id aus dem Pfad kommt."""

    valid_from: date
    valid_to: date | None = None
    employment_percentage: int = Field(ge=1, le=100)
    notes: str | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "EmploymentPeriodBody":
        if self.valid_to is not None and self.valid_from >= self.valid_to:
            raise ValueError("valid_from muss vor valid_to liegen")
        return self
