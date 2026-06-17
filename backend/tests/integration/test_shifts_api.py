"""Integration-Tests für PATCH /api/shifts/{shift_id}."""
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.absence import Absence, AbsenceType

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _seed_shift_types(client: TestClient) -> dict[str, int]:
    types = [
        {
            "name": "V-Dienst",
            "short_name": "V",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 1,
        },
        {
            "name": "Nachtdienst",
            "short_name": "N",
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "display_order": 2,
        },
    ]
    result: dict[str, int] = {}
    for t in types:
        r = client.post("/api/shift-types", json=t)
        assert r.status_code == 201, r.text
        result[t["short_name"]] = r.json()["id"]
    return result


def _create_plan(client: TestClient) -> dict:
    r = client.post(
        "/api/plans",
        json={"name": "Plan", "valid_from": "2026-04-01", "valid_to": "2026-04-30"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_doctor(client: TestClient, name: str = "Dr. Test", **kwargs) -> dict:
    r = client.post("/api/doctors", json={"last_name": name, **kwargs})
    assert r.status_code == 201, r.text
    return r.json()


def _get_first_shift_id(plan: dict) -> int:
    return plan["shifts"][0]["id"]


def _add_absence(client: TestClient, doctor_id: int) -> None:
    """Fügt eine Urlaubsabwesenheit direkt in die DB ein (kein Absence-Endpunkt in M2)."""
    override = client.app.dependency_overrides.get(get_db)
    assert override is not None
    session: Session = next(override())
    absence = Absence(
        doctor_id=doctor_id,
        absence_type=AbsenceType.URLAUB,
        valid_from=date(2026, 4, 1),
        valid_to=date(2026, 4, 30),
    )
    session.add(absence)
    session.commit()


# ---------------------------------------------------------------------------
# Erfolgs-Cases
# ---------------------------------------------------------------------------


def test_patch_shift_assigns_doctor(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["doctor_id"] == doctor["id"]
    assert data["doctor"]["id"] == doctor["id"]


def test_patch_shift_clears_doctor(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    shift_id = _get_first_shift_id(plan)

    # Erst zuweisen
    client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    # Dann wieder freigeben
    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": None})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["doctor_id"] is None
    assert data["doctor"] is None


def test_patch_shift_no_change_if_field_omitted(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    shift_id = _get_first_shift_id(plan)

    client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    # Nur is_pinned ändern – doctor_id soll unverändert bleiben
    r = client.patch(f"/api/shifts/{shift_id}", json={"is_pinned": True})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["doctor_id"] == doctor["id"]
    assert data["is_pinned"] is True


def test_patch_shift_sets_pinned(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"is_pinned": True})
    assert r.status_code == 200, r.text
    assert r.json()["is_pinned"] is True


def test_patch_shift_updates_notes(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"notes": "Kurze Notiz"})
    assert r.status_code == 200, r.text
    assert r.json()["notes"] == "Kurze Notiz"


def test_patch_shift_all_fields_at_once(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(
        f"/api/shifts/{shift_id}",
        json={"doctor_id": doctor["id"], "is_pinned": True, "notes": "Alles auf einmal"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["doctor_id"] == doctor["id"]
    assert data["is_pinned"] is True
    assert data["notes"] == "Alles auf einmal"


# ---------------------------------------------------------------------------
# Validierungs-Cases (hart)
# ---------------------------------------------------------------------------


def test_patch_shift_404_when_not_exists(client: TestClient) -> None:
    r = client.patch("/api/shifts/999999", json={"is_pinned": True})
    assert r.status_code == 404


def test_patch_shift_422_when_doctor_not_exists(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": 999999})
    assert r.status_code == 422


def test_patch_shift_422_when_doctor_inactive(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client, name="Dr. Inaktiv")
    shift_id = _get_first_shift_id(plan)

    # Doctor deaktivieren
    client.patch(f"/api/doctors/{doctor['id']}", json={"active": False})

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 422


def test_patch_shift_422_when_extra_field(client: TestClient) -> None:
    _seed_shift_types(client)
    plan = _create_plan(client)
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctorid": 1})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Weiche Validierung (semantisch – alles erlaubt, kein Block)
# ---------------------------------------------------------------------------


def test_patch_shift_assigns_doctor_on_vacation(client: TestClient) -> None:
    """Doctor im Urlaub kann trotzdem zugewiesen werden (weiche Validierung)."""
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client, name="Dr. Urlaub")
    shift_id = _get_first_shift_id(plan)
    _add_absence(client, doctor["id"])

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 200, r.text


def test_patch_shift_double_booking_allowed(client: TestClient) -> None:
    """Doctor bereits an einem anderen Shift am gleichen Tag → trotzdem erlaubt."""
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client, name="Dr. Doppelt")
    shifts = plan["shifts"]

    # Zwei Shifts am gleichen Tag (V und N)
    same_day_shifts = [s for s in shifts if s["shift_date"] == shifts[0]["shift_date"]]
    assert len(same_day_shifts) >= 2, "Erwartet mindestens 2 Shifts am ersten Tag"

    client.patch(f"/api/shifts/{same_day_shifts[0]['id']}", json={"doctor_id": doctor["id"]})
    r = client.patch(f"/api/shifts/{same_day_shifts[1]['id']}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 200, r.text


def test_patch_shift_missing_qualification_allowed(client: TestClient) -> None:
    """Doctor ohne besondere Qualifikation kann zugewiesen werden."""
    _seed_shift_types(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client, name="Dr. OhneQuali")
    shift_id = _get_first_shift_id(plan)

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 200, r.text
