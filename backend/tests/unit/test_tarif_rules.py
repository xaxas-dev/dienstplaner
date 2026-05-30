"""Tests für tarif_rules: BD-Opt-out-Konstanten und get_weekly_hours_limit() Helper."""
from app.solver.tarif_rules import (
    MAX_WEEKLY_HOURS_MINUTES,
    MAX_WEEKLY_HOURS_MINUTES_BD1,
    MAX_WEEKLY_HOURS_MINUTES_BD2,
    get_weekly_hours_limit,
)


def test_get_weekly_hours_limit_kein_optout() -> None:
    """Kein Opt-out → Standard 48h/Woche."""
    assert get_weekly_hours_limit(None) == MAX_WEEKLY_HOURS_MINUTES  # 2880


def test_get_weekly_hours_limit_bd1() -> None:
    """Opt-out Stufe 1 → 58h/Woche."""
    assert get_weekly_hours_limit(1) == MAX_WEEKLY_HOURS_MINUTES_BD1  # 3480


def test_get_weekly_hours_limit_bd2() -> None:
    """Opt-out Stufe 2 → 54h/Woche."""
    assert get_weekly_hours_limit(2) == MAX_WEEKLY_HOURS_MINUTES_BD2  # 3240
