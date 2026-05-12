from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AppSettingResponse(BaseModel):
    key: str
    value: str
    description: str | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AppSettingUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=1000)
