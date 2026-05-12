"""Tests für die App-Settings API und den ShiftType-Seed."""

import sys
from datetime import datetime, time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.app_setting import AppSetting  # noqa: E402
from app.models.shift_type import ShiftType  # noqa: E402

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def clinic_name_setting(db):
    setting = AppSetting(
        key="clinic_name",
        value="Neurologie UKSH Lübeck",
        description="Name der Klinik (wird im Header angezeigt)",
        updated_at=datetime.now(),
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@pytest.fixture
def shift_types_without_times(db):
    """V, T, N ohne Uhrzeiten; T1 hat bereits Uhrzeiten."""
    entries = [
        ShiftType(
            name="V-Dienst",
            short_name="V",
            applies_on_weekdays=True,
            applies_on_weekend=False,
            display_order=1,
        ),
        ShiftType(
            name="Tagdienst",
            short_name="T",
            applies_on_weekdays=False,
            applies_on_weekend=True,
            display_order=2,
        ),
        ShiftType(
            name="Nachtdienst",
            short_name="N",
            applies_on_weekdays=True,
            applies_on_weekend=True,
            display_order=3,
        ),
        ShiftType(
            name="Tagdienst INA",
            short_name="T1",
            applies_on_weekdays=True,
            applies_on_weekend=False,
            start_time=time(7, 30),
            end_time=time(16, 0),
            display_order=4,
            notes="Tagdienst Interdisziplinäre Notaufnahme (Mo-Fr)",
        ),
    ]
    for entry in entries:
        db.add(entry)
    db.commit()
    yield entries
    # Cleanup: apply_seed committet, daher explizit löschen
    db.query(ShiftType).delete(synchronize_session=False)
    db.commit()


# ---------------------------------------------------------------------------
# AppSettings API
# ---------------------------------------------------------------------------


def test_app_settings_listed_after_migration(client, clinic_name_setting):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert any(s["key"] == "clinic_name" for s in data)


def test_get_setting_existing(client, clinic_name_setting):
    response = client.get("/api/settings/clinic_name")
    assert response.status_code == 200
    data = response.json()
    assert data["key"] == "clinic_name"
    assert data["value"] == "Neurologie UKSH Lübeck"


def test_get_setting_404(client):
    response = client.get("/api/settings/unknown_key")
    assert response.status_code == 404


def test_update_setting(client, clinic_name_setting):
    response = client.patch("/api/settings/clinic_name", json={"value": "Neue Klinik"})
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == "Neue Klinik"

    get_response = client.get("/api/settings/clinic_name")
    assert get_response.json()["value"] == "Neue Klinik"


def test_update_setting_404(client):
    response = client.patch("/api/settings/unknown_key", json={"value": "Test"})
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# ShiftType-Seed
# ---------------------------------------------------------------------------


def test_shift_types_have_times_after_seed(db, shift_types_without_times):
    from scripts.seed_shift_types import SHIFT_TYPES, apply_seed

    apply_seed(db)

    expected = {
        st_data["name"]: (st_data["start_time"], st_data["end_time"])
        for st_data in SHIFT_TYPES
    }

    for st in db.query(ShiftType).all():
        assert st.start_time is not None, f"{st.name}: start_time ist null"
        assert st.end_time is not None, f"{st.name}: end_time ist null"
        exp_start, exp_end = expected[st.name]
        assert st.start_time == exp_start, f"{st.name}: start_time falsch"
        assert st.end_time == exp_end, f"{st.name}: end_time falsch"


def test_shift_types_seed_idempotent_for_times(db, shift_types_without_times):
    """Zweiter Seed-Lauf überschreibt manuell gesetzte Zeiten nicht."""
    from scripts.seed_shift_types import apply_seed

    # Manuelle Zeit für V-Dienst setzen
    v_dienst = db.query(ShiftType).filter(ShiftType.short_name == "V").first()
    manual_start = time(8, 0)
    manual_end = time(16, 0)
    v_dienst.start_time = manual_start
    v_dienst.end_time = manual_end
    db.commit()

    apply_seed(db)

    db.refresh(v_dienst)
    assert v_dienst.start_time == manual_start, "Manuelle start_time wurde überschrieben"
    assert v_dienst.end_time == manual_end, "Manuelle end_time wurde überschrieben"
