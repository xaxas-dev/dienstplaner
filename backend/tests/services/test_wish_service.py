import pytest
from datetime import date
from pydantic import ValidationError
from app.schemas.wish import WishCreateBody
from app.models.wish import WishType


def test_avoid_day_with_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_DAY, shift_type_id=1)


def test_avoid_shift_without_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_SHIFT)


def test_require_shift_without_shift_type_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(day_of_week=4, wish_type=WishType.REQUIRE_SHIFT)


def test_both_date_and_day_of_week_raises():
    with pytest.raises(ValidationError):
        WishCreateBody(wish_date=date(2026, 3, 15), day_of_week=4, wish_type=WishType.AVOID_DAY)


def test_valid_date_avoid_day():
    w = WishCreateBody(wish_date=date(2026, 3, 15), wish_type=WishType.AVOID_DAY)
    assert w.wish_date == date(2026, 3, 15)
    assert w.day_of_week is None


def test_valid_weekday_avoid_shift():
    w = WishCreateBody(day_of_week=4, wish_type=WishType.AVOID_SHIFT, shift_type_id=1)
    assert w.day_of_week == 4
    assert w.wish_date is None


def test_valid_general_require_shift():
    w = WishCreateBody(wish_type=WishType.REQUIRE_SHIFT, shift_type_id=2)
    assert w.wish_date is None
    assert w.day_of_week is None
