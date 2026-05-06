from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.doctor import DoctorType


class DoctorBase(BaseModel):
    name: str = Field(max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType = DoctorType.INTERNAL
    weiterbildungsjahr: int | None = Field(default=None, ge=1, le=6)
    is_facharzt: bool = False
    active: bool = True
    notes: str | None = None


class DoctorCreate(DoctorBase): ...


class DoctorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    doctor_type: DoctorType | None = None
    weiterbildungsjahr: int | None = Field(default=None, ge=1, le=6)
    is_facharzt: bool | None = None
    active: bool | None = None
    notes: str | None = None


class DoctorResponse(DoctorBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
