from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlanVersionCreate(BaseModel):
    plan_id: int
    version_number: int = Field(ge=1)
    snapshot_json: dict[str, Any]
    comment: str | None = None


class PlanVersionResponse(BaseModel):
    id: int
    plan_id: int
    version_number: int
    snapshot_json: dict[str, Any]
    comment: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
