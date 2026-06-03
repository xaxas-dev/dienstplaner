from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.wish import WishType


def _validate_wish_fields(
    wish_date: date | None,
    day_of_week: int | None,
    wish_type: WishType,
    shift_type_id: int | None,
) -> None:
    if wish_date is not None and day_of_week is not None:
        raise ValueError("wish_date und day_of_week dürfen nicht gleichzeitig gesetzt sein")
    if wish_type == WishType.AVOID_DAY and shift_type_id is not None:
        raise ValueError("AVOID_DAY darf keine shift_type_id haben")
    if wish_type in (WishType.AVOID_SHIFT, WishType.REQUIRE_SHIFT) and shift_type_id is None:
        raise ValueError("AVOID_SHIFT und REQUIRE_SHIFT erfordern eine shift_type_id")


class WishBase(BaseModel):
    doctor_id: int
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType
    shift_type_id: int | None = None
    priority: int = Field(default=1, ge=1, le=3)
    notes: str | None = None


class WishCreate(WishBase):
    @model_validator(mode="after")
    def check_consistency(self) -> WishCreate:
        _validate_wish_fields(self.wish_date, self.day_of_week, self.wish_type, self.shift_type_id)
        return self


class WishCreateBody(BaseModel):
    """Request body for POST /api/doctors/{id}/wishes — doctor_id wird aus URL-Pfad injiziert."""
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType
    shift_type_id: int | None = None
    priority: int = Field(default=1, ge=1, le=3)
    notes: str | None = None

    @model_validator(mode="after")
    def check_consistency(self) -> WishCreateBody:
        _validate_wish_fields(self.wish_date, self.day_of_week, self.wish_type, self.shift_type_id)
        return self


class WishUpdate(BaseModel):
    wish_date: date | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    wish_type: WishType | None = None
    shift_type_id: int | None = None
    priority: int | None = Field(default=None, ge=1, le=3)
    notes: str | None = None


class WishResponse(WishBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
