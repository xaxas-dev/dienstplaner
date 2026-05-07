from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.wish import WishType


class WishBase(BaseModel):
    doctor_id: int
    wish_date: date
    wish_type: WishType
    shift_type_id: int | None = None
    priority: int = Field(default=1, ge=1, le=3)
    notes: str | None = None


class WishCreate(WishBase):
    @model_validator(mode="after")
    def check_shift_type_consistency(self) -> WishCreate:
        if self.wish_type == WishType.AVOID_DAY and self.shift_type_id is not None:
            raise ValueError("AVOID_DAY darf keine shift_type_id haben")
        if self.wish_type in (WishType.AVOID_SHIFT, WishType.REQUIRE_SHIFT) and (
            self.shift_type_id is None
        ):
            raise ValueError("AVOID_SHIFT und REQUIRE_SHIFT erfordern eine shift_type_id")
        return self


class WishUpdate(BaseModel):
    wish_date: date | None = None
    wish_type: WishType | None = None
    shift_type_id: int | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    notes: str | None = None


class WishResponse(WishBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
