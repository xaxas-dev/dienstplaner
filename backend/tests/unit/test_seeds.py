"""Unit-Tests für Seed-Daten: prüft Korrektheit der Konstanten ohne DB-Zugriff."""

from scripts.seed_departments import DEPARTMENTS, HEADCOUNT_DEFAULTS
from scripts.seed_shift_types import SHIFT_TYPES


def test_seed_ck_has_requires_full_time() -> None:
    ck = next((d for d in DEPARTMENTS if d["name"] == "Curschmann Klinik"), None)
    assert ck is not None, "Curschmann Klinik fehlt in DEPARTMENTS"
    assert ck.get("requires_full_time") is True


def test_seed_other_departments_no_requires_full_time() -> None:
    for dept in DEPARTMENTS:
        if dept["name"] != "Curschmann Klinik":
            assert dept.get("requires_full_time", False) is False, (
                f"{dept['name']} sollte requires_full_time=False haben"
            )


def test_seed_two_new_departments() -> None:
    names = [d["name"] for d in DEPARTMENTS]
    assert "Intensiv (NCH)" in names
    assert "Intensiv extern" in names
    assert len(DEPARTMENTS) == 23


def test_seed_new_departments_are_external() -> None:
    nch = next(d for d in DEPARTMENTS if d["name"] == "Intensiv (NCH)")
    ext = next(d for d in DEPARTMENTS if d["name"] == "Intensiv extern")
    assert nch["is_external"] is True
    assert ext["is_external"] is True
    assert nch["display_order"] == 22
    assert ext["display_order"] == 23


def test_seed_headcount_defaults_all_departments_covered() -> None:
    dept_names = {d["name"] for d in DEPARTMENTS}
    for name in HEADCOUNT_DEFAULTS:
        assert name in dept_names, f"HEADCOUNT_DEFAULTS enthält unbekannten Bereich: {name}"
    assert len(HEADCOUNT_DEFAULTS) == 23


def test_seed_headcount_su_values() -> None:
    assert HEADCOUNT_DEFAULTS["SU"] == (6, 8)
    assert HEADCOUNT_DEFAULTS["ZIP"] == (0, 1)
    assert HEADCOUNT_DEFAULTS["Curschmann Klinik"] == (None, None)


def test_seed_t1_present() -> None:
    t1 = next((s for s in SHIFT_TYPES if s.get("short_name") == "T1"), None)
    assert t1 is not None, "T1 fehlt in SHIFT_TYPES"
    assert t1["name"] == "Tagdienst INA"
    assert t1["applies_on_weekdays"] is True
    assert t1["applies_on_weekend"] is False
    assert t1["display_order"] == 4
