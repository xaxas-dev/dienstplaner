from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class QualificationBase(BaseModel):
    name: str = Field(max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    description: str | None = None
    active: bool = True


class QualificationCreate(QualificationBase): ...


class QualificationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    short_name: str | None = Field(default=None, max_length=50)
    description: str | None = None
    active: bool | None = None


class QualificationResponse(QualificationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
