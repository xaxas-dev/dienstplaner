"""Unit-Tests für Seed-Daten: prüft Korrektheit der Konstanten ohne DB-Zugriff."""

from scripts.seed_departments import DEPARTMENTS
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


def test_seed_t1_present() -> None:
    t1 = next((s for s in SHIFT_TYPES if s.get("short_name") == "T1"), None)
    assert t1 is not None, "T1 fehlt in SHIFT_TYPES"
    assert t1["name"] == "Tagdienst INA"
    assert t1["applies_on_weekdays"] is True
    assert t1["applies_on_weekend"] is False
    assert t1["display_order"] == 4
