from datetime import date, timedelta

from app.models.plan import Plan
from app.models.shift_type import ShiftType
from app.services.plan_service import _apply_rotation_offset, _generate_shift_dicts

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _st(id: int, short_name: str, weekday: bool, weekend: bool) -> ShiftType:
    st = ShiftType()
    st.id = id
    st.short_name = short_name
    st.applies_on_weekdays = weekday
    st.applies_on_weekend = weekend
    st.active = True
    return st


def _plan(valid_from: date, valid_to: date) -> Plan:
    p = Plan()
    p.id = 1
    p.valid_from = valid_from
    p.valid_to = valid_to
    return p


# ---------------------------------------------------------------------------
# generate_shifts
# ---------------------------------------------------------------------------

# April 2026: Mo 1.4. (Wed), 30 Tage, 22 Werktage, 8 Wochenendtage


def test_generate_shifts_april_count() -> None:
    shift_types = [
        _st(1, "V", weekday=True, weekend=False),
        _st(2, "T", weekday=False, weekend=True),
        _st(3, "N", weekday=True, weekend=True),
    ]
    result = _generate_shift_dicts(1, date(2026, 4, 1), date(2026, 4, 30), shift_types)
    assert len(result) == 60  # 22*2 + 8*2


def test_generate_shifts_with_t1_filter() -> None:
    shift_types = [
        _st(1, "V", weekday=True, weekend=False),
        _st(2, "T", weekday=False, weekend=True),
        _st(3, "N", weekday=True, weekend=True),
        _st(4, "T1", weekday=True, weekend=False),
    ]
    result = _generate_shift_dicts(1, date(2026, 4, 1), date(2026, 4, 30), shift_types)
    # V+N+T1 an Werktagen (22×3=66), T+N am Wochenende (8×2=16)
    assert len(result) == 82


def test_generate_shifts_single_day_weekday() -> None:
    # 2026-04-01 ist Mittwoch (Werktag)
    shift_types = [
        _st(1, "V", weekday=True, weekend=False),
        _st(2, "T", weekday=False, weekend=True),
        _st(3, "N", weekday=True, weekend=True),
    ]
    result = _generate_shift_dicts(1, date(2026, 4, 1), date(2026, 4, 1), shift_types)
    assert len(result) == 2  # V + N, kein T


def test_generate_shifts_single_day_weekend() -> None:
    # 2026-04-04 ist Samstag
    shift_types = [
        _st(1, "V", weekday=True, weekend=False),
        _st(2, "T", weekday=False, weekend=True),
        _st(3, "N", weekday=True, weekend=True),
    ]
    result = _generate_shift_dicts(1, date(2026, 4, 4), date(2026, 4, 4), shift_types)
    assert len(result) == 2  # T + N, kein V


# ---------------------------------------------------------------------------
# clone offset und clipping
# ---------------------------------------------------------------------------


def test_clone_offset_calculation() -> None:
    # Einfaches Verschieben ohne Clipping: April → Juni (gleiche Länge)
    offset = date(2026, 6, 1) - date(2026, 4, 1)  # 61 Tage

    old_from = date(2026, 4, 1)
    old_to = date(2026, 4, 15)
    result = _apply_rotation_offset(old_from, old_to, offset, date(2026, 6, 1), date(2026, 6, 30))
    assert result is not None
    new_from, new_to = result
    assert new_from == date(2026, 6, 1)
    assert new_to == date(2026, 6, 15)


def test_clone_clipping_lower() -> None:
    # Rotation beginnt vor neuem Plan → wird geclippt
    offset = timedelta(days=10)
    result = _apply_rotation_offset(
        date(2026, 4, 1), date(2026, 4, 20), offset, date(2026, 4, 15), date(2026, 4, 30)
    )
    assert result is not None
    new_from, new_to = result
    assert new_from == date(2026, 4, 15)  # geclippt auf Plan-Beginn
    assert new_to == date(2026, 4, 30)


def test_clone_clipping_upper() -> None:
    # Rotation endet nach neuem Plan → wird geclippt
    offset = timedelta(days=5)
    result = _apply_rotation_offset(
        date(2026, 4, 1), date(2026, 4, 30), offset, date(2026, 4, 1), date(2026, 4, 20)
    )
    assert result is not None
    new_from, new_to = result
    assert new_from == date(2026, 4, 6)
    assert new_to == date(2026, 4, 20)  # geclippt auf Plan-Ende


def test_clone_clipping_skipped_before() -> None:
    # new_to < plan_valid_from → komplett wegfallen
    offset = timedelta(days=-60)
    result = _apply_rotation_offset(
        date(2026, 4, 1), date(2026, 4, 30), offset, date(2026, 6, 1), date(2026, 6, 30)
    )
    assert result is None


def test_clone_clipping_skipped_after() -> None:
    # new_from > plan_valid_to → komplett wegfallen
    offset = timedelta(days=60)
    result = _apply_rotation_offset(
        date(2026, 4, 1), date(2026, 4, 30), offset, date(2026, 4, 1), date(2026, 4, 30)
    )
    assert result is None
