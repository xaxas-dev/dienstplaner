"""Smoke-Test: vollständiger Plan-Lifecycle von Anlage bis Export.

Prüft den End-to-End-Flow durch alle wichtigen API-Endpunkte:
Doctor → ShiftType → Plan (Shifts auto-generiert) → Shift belegen →
Konflikte abrufen → Excel-Export.
"""
from fastapi.testclient import TestClient


def test_plan_lifecycle_smoke(client: TestClient) -> None:
    # 1. Doctor anlegen
    r = client.post(
        "/api/doctors",
        json={"last_name": "Smoke Doctor", "short_name": "SD"},
    )
    assert r.status_code == 201, r.text
    doctor_id = r.json()["id"]

    # 2. ShiftType anlegen — Plan-Erstellung generiert daraus automatisch Shifts
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Smoke-Dienst",
            "short_name": "SM",
            "applies_on_weekdays": True,
            "applies_on_weekend": False,
            "display_order": 99,
        },
    )
    assert r.status_code == 201, r.text

    # 3. Plan anlegen — Response enthält bereits auto-generierte Shifts
    r = client.post(
        "/api/plans",
        json={
            "name": "Smoke-Plan Mai 2026",
            "valid_from": "2026-05-01",
            "valid_to": "2026-05-31",
        },
    )
    assert r.status_code == 201, r.text
    plan = r.json()
    plan_id = plan["id"]

    # 4. Ersten Shift aus der Plan-Response holen (Shifts werden bei Plan-Anlage erzeugt)
    assert len(plan["shifts"]) > 0, "Plan sollte auto-generierte Shifts enthalten"
    shift_id = plan["shifts"][0]["id"]

    # 5. Shift belegen (Doctor zuweisen)
    r = client.patch(
        f"/api/shifts/{shift_id}",
        json={"doctor_id": doctor_id},
    )
    assert r.status_code == 200, r.text
    assert r.json()["doctor_id"] == doctor_id

    # 6. Konflikte abrufen (muss 200 liefern, kein 404)
    r = client.get(f"/api/plans/{plan_id}/conflicts")
    assert r.status_code == 200, r.text
    payload = r.json()
    assert "conflicts" in payload

    # 7. Excel-Export (muss 200 + xlsx MIME liefern)
    r = client.get(f"/api/plans/{plan_id}/export")
    assert r.status_code == 200, r.text
    assert "spreadsheetml" in r.headers.get("content-type", "")
    assert len(r.content) > 0
