"""Integration-Tests für die Konflikt-Engine-Endpunkte."""
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.absence import Absence, AbsenceType

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _seed_shift_type(client: TestClient) -> int:
    r = client.post(
        "/api/shift-types",
        json={
            "name": "V-Dienst",
            "short_name": "V",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 1,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _create_plan(client: TestClient) -> dict:
    r = client.post(
        "/api/plans",
        json={"name": "Testplan", "valid_from": "2026-05-01", "valid_to": "2026-05-31"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_doctor(client: TestClient, name: str = "Dr. Test") -> dict:
    r = client.post("/api/doctors", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _add_absence_for_month(db: Session, doctor_id: int) -> None:
    """Setzt den Arzt für den gesamten Testmonat auf Urlaub (kein Absence-Endpunkt)."""
    db.add(
        Absence(
            doctor_id=doctor_id,
            absence_type=AbsenceType.URLAUB,
            valid_from=date(2026, 5, 1),
            valid_to=date(2026, 5, 31),
        )
    )
    db.commit()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_get_conflicts_returns_aggregate(client: TestClient) -> None:
    _seed_shift_type(client)
    plan = _create_plan(client)
    plan_id = plan["id"]

    r = client.get(f"/api/plans/{plan_id}/conflicts")
    assert r.status_code == 200
    data = r.json()
    assert data["plan_id"] == plan_id
    assert "conflicts" in data
    assert "conflict_count" in data
    assert "open_shifts" in data
    assert "open_shift_count" in data
    assert data["conflict_count"] == len(data["conflicts"])
    assert data["open_shift_count"] == len(data["open_shifts"])


def test_get_conflicts_404_unknown_plan(client: TestClient) -> None:
    r = client.get("/api/plans/999999/conflicts")
    assert r.status_code == 404


def test_get_shifts_embeds_conflicts(client: TestClient, db: Session) -> None:
    _seed_shift_type(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    plan_id = plan["id"]
    doctor_id = doctor["id"]

    shift_id = plan["shifts"][0]["id"]
    client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor_id})

    # Arzt in Urlaub → NOT_AVAILABLE auf dem zugewiesenen Shift
    _add_absence_for_month(db, doctor_id)

    r = client.get(f"/api/plans/{plan_id}/shifts")
    assert r.status_code == 200
    target = next(s for s in r.json() if s["id"] == shift_id)
    assert len(target["conflicts"]) > 0
    assert target["conflicts"][0]["conflict_type"] == "not_available"


def test_patch_response_has_no_conflicts(client: TestClient) -> None:
    _seed_shift_type(client)
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    shift_id = plan["shifts"][0]["id"]

    r = client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"]})
    assert r.status_code == 200
    # conflicts bleibt leer – bewusste Entkopplung (ADR M2-005)
    assert r.json().get("conflicts", []) == []
