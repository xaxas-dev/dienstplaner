from datetime import date as date_type

from pydantic import BaseModel

from app.models.holiday import HolidaySource


class HolidayResponse(BaseModel):
    date: date_type
    name: str
    source: HolidaySource

    model_config = {"from_attributes": True}


class HolidayCreate(BaseModel):
    date: date_type
    name: str


class HolidaySeedRequest(BaseModel):
    year: int
