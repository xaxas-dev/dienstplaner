from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class DoctorQualificationBase(BaseModel):
    doctor_id: int
    qualification_id: int
    acquired_at: date | None = None
    expires_at: date | None = None


class DoctorQualificationCreate(DoctorQualificationBase): ...


class DoctorQualificationUpdate(BaseModel):
    acquired_at: date | None = None
    expires_at: date | None = None


class DoctorQualificationResponse(DoctorQualificationBase):
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DoctorQualificationBody(BaseModel):
    """Optionaler Body für die Qualifikations-Zuweisung (Pfad liefert IDs)."""

    acquired_at: date | None = None
    expires_at: date | None = None
