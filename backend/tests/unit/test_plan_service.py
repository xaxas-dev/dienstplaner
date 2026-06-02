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


# ---------------------------------------------------------------------------
# T-Logik: WE ODER Feiertag
# ---------------------------------------------------------------------------


def test_generate_shifts_holiday_on_weekday_gets_weekend_shifts() -> None:
    """Ein Feiertag (Montag) erhält applies_on_weekend-Shifts statt Werktags-Shifts."""
    monday = date(2026, 4, 6)  # Ostermontag 2026 — ist Montag (Werktag)
    assert monday.isoweekday() == 1  # Sicherstellung: das ist wirklich ein Montag

    t_shift = _st(1, "T", weekday=False, weekend=True)
    v_shift = _st(2, "V", weekday=True, weekend=False)
    n_shift = _st(3, "N", weekday=True, weekend=True)

    result = _generate_shift_dicts(1, monday, monday, [t_shift, v_shift, n_shift], {monday})

    shift_type_ids = {d["shift_type_id"] for d in result}
    assert 1 in shift_type_ids   # T-Shift auf Feiertag
    assert 3 in shift_type_ids   # N-Shift (applies both) auf Feiertag
    assert 2 not in shift_type_ids  # V-Shift NICHT auf Feiertag (weekday-only)


def test_generate_shifts_regular_monday_no_holiday() -> None:
    """Normaler Montag (kein Feiertag) behält ursprüngliches Verhalten."""
    monday = date(2026, 4, 13)  # normaler Montag
    assert monday.isoweekday() == 1

    t_shift = _st(1, "T", weekday=False, weekend=True)
    v_shift = _st(2, "V", weekday=True, weekend=False)

    result = _generate_shift_dicts(1, monday, monday, [t_shift, v_shift])

    shift_type_ids = {d["shift_type_id"] for d in result}
    assert 1 not in shift_type_ids  # T-Shift NICHT auf normalem Montag
    assert 2 in shift_type_ids      # V-Shift auf normalem Montag


def test_generate_shifts_holiday_none_means_no_change() -> None:
    """holiday_dates=None verhält sich wie leeres Set."""
    monday = date(2026, 4, 13)
    t_shift = _st(1, "T", weekday=False, weekend=True)

    result_none = _generate_shift_dicts(1, monday, monday, [t_shift], None)
    result_no_arg = _generate_shift_dicts(1, monday, monday, [t_shift])
    assert result_none == result_no_arg == []


def test_generate_shifts_april_with_easter_holidays() -> None:
    """April 2026 mit Oster-Feiertagen verändert T/V-Zählung korrekt."""
    t_shift = _st(1, "T", weekday=False, weekend=True)
    v_shift = _st(2, "V", weekday=True, weekend=False)
    n_shift = _st(3, "N", weekday=True, weekend=True)

    # April 2026 ohne Feiertage: 8 WE-Tage (Sa/So), 22 Werktage.
    # Feiertage: Karfreitag (Fr 3.4. = isoweekday 5, Werktag → WE-äquivalent),
    #            Ostersonntag (So 5.4. = bereits WE, kein Effekt),
    #            Ostermontag (Mo 6.4. = isoweekday 1, Werktag → WE-äquivalent).
    # Ergebnis: 8 + 2 = 10 WE-äquivalente Tage, 22 - 2 = 20 Werktage.
    holiday_dates = {date(2026, 4, 3), date(2026, 4, 5), date(2026, 4, 6)}
    result = _generate_shift_dicts(
        1, date(2026, 4, 1), date(2026, 4, 30),
        [t_shift, v_shift, n_shift],
        holiday_dates,
    )

    v_count = sum(1 for d in result if d["shift_type_id"] == 2)
    t_count = sum(1 for d in result if d["shift_type_id"] == 1)
    assert v_count == 20
    assert t_count == 10
