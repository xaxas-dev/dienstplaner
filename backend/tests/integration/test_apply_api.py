"""Integration-Tests für POST /api/plans/{id}/apply (Sub-Schritt C).

Kein JVM-Guard — apply braucht kein timefold.

Testet:
  - 200 + korrektes ApplyResult
  - DB-Shift hat nach Apply die neue doctor_id
  - 404 für unbekannten Plan
  - Gepinnter Shift landet in skipped_pinned, DB unverändert
  - is_pinned bleibt False nach Apply
  - 422 bei fehlenden proposed_assignments
"""
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _create_shift_types(client: TestClient) -> dict[str, int]:
    types = [
        {"name": "V-Apply-IT", "short_name": "VAI", "applies_on_weekdays": True,
         "applies_on_weekend": False, "display_order": 10},
        {"name": "N-Apply-IT", "short_name": "NAI", "applies_on_weekdays": True,
         "applies_on_weekend": True, "display_order": 11},
    ]
    result: dict[str, int] = {}
    for t in types:
        r = client.post("/api/shift-types", json=t)
        assert r.status_code == 201, r.text
        result[t["short_name"]] = r.json()["id"]
    return result


def _create_doctor(client: TestClient, name: str) -> dict:
    r = client.post("/api/doctors", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_plan(client: TestClient, st_ids: list[int]) -> dict:
    r = client.post(
        "/api/plans",
        json={
            "name": "ApplyTest",
            "valid_from": "2026-07-01",
            "valid_to": "2026-07-01",
            "shift_type_ids": st_ids,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_apply_200_gibt_apply_result_zurueck(client: TestClient) -> None:
    """HTTP 200 mit ApplyResult-Feldern plan_id, applied, skipped_pinned."""
    st = _create_shift_types(client)
    doctor = _create_doctor(client, "Dr. ApplyA")
    plan = _create_plan(client, list(st.values()))

    # Ersten offenen Shift holen
    shifts_r = client.get(f"/api/plans/{plan['id']}/shifts")
    shift = shifts_r.json()[0]

    r = client.post(
        f"/api/plans/{plan['id']}/apply",
        json={"proposed_assignments": [{"shift_id": shift["id"], "doctor_id": doctor["id"]}]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["plan_id"] == plan["id"]
    assert shift["id"] in body["applied"]
    assert body["skipped_pinned"] == []


def test_apply_schreibt_doctor_in_db(client: TestClient) -> None:
    """Nach Apply hat der Shift die zugewiesene doctor_id in der DB."""
    st = _create_shift_types(client)
    doctor = _create_doctor(client, "Dr. ApplyB")
    plan = _create_plan(client, list(st.values()))

    shift_id = client.get(f"/api/plans/{plan['id']}/shifts").json()[0]["id"]

    client.post(
        f"/api/plans/{plan['id']}/apply",
        json={"proposed_assignments": [{"shift_id": shift_id, "doctor_id": doctor["id"]}]},
    )

    # Schicht erneut lesen — doctor_id muss gesetzt sein
    shifts = client.get(f"/api/plans/{plan['id']}/shifts").json()
    updated = next(s for s in shifts if s["id"] == shift_id)
    assert updated["doctor_id"] == doctor["id"]


def test_apply_404_unbekannter_plan(client: TestClient) -> None:
    """Unbekannte plan_id → 404."""
    r = client.post(
        "/api/plans/99999/apply",
        json={"proposed_assignments": []},
    )
    assert r.status_code == 404


def test_apply_gepinnter_shift_in_skipped_pinned(client: TestClient) -> None:
    """Gepinnter Shift landet in skipped_pinned, DB bleibt unverändert."""
    st = _create_shift_types(client)
    doctor = _create_doctor(client, "Dr. ApplyC")
    plan = _create_plan(client, list(st.values()))

    shift_id = client.get(f"/api/plans/{plan['id']}/shifts").json()[0]["id"]

    # Shift pinnen (mit doctor zuweisen und pinnen)
    client.patch(f"/api/shifts/{shift_id}", json={"doctor_id": doctor["id"], "is_pinned": True})

    # Versuche, den gepinnten Shift neu zuzuweisen (doctor=None)
    r = client.post(
        f"/api/plans/{plan['id']}/apply",
        json={"proposed_assignments": [{"shift_id": shift_id, "doctor_id": None}]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert shift_id in body["skipped_pinned"]
    assert body["applied"] == []

    # DB: doctor_id darf nicht geändert worden sein
    shifts = client.get(f"/api/plans/{plan['id']}/shifts").json()
    shift = next(s for s in shifts if s["id"] == shift_id)
    assert shift["doctor_id"] == doctor["id"]


def test_apply_is_pinned_bleibt_false(client: TestClient) -> None:
    """Apply verändert is_pinned nicht — Shift bleibt ungepinnt."""
    st = _create_shift_types(client)
    doctor = _create_doctor(client, "Dr. ApplyD")
    plan = _create_plan(client, list(st.values()))

    shift_id = client.get(f"/api/plans/{plan['id']}/shifts").json()[0]["id"]

    client.post(
        f"/api/plans/{plan['id']}/apply",
        json={"proposed_assignments": [{"shift_id": shift_id, "doctor_id": doctor["id"]}]},
    )

    shifts = client.get(f"/api/plans/{plan['id']}/shifts").json()
    shift = next(s for s in shifts if s["id"] == shift_id)
    assert shift["is_pinned"] is False


def test_apply_422_bei_fehlendem_body(client: TestClient) -> None:
    """Fehlender Request-Body → 422 Unprocessable Entity."""
    st = _create_shift_types(client)
    plan = _create_plan(client, list(st.values()))

    r = client.post(f"/api/plans/{plan['id']}/apply", json={})
    assert r.status_code == 422


def test_apply_422_bei_ungueltigem_extra_feld(client: TestClient) -> None:
    """Unbekanntes Feld im Body → 422 (extra='forbid')."""
    st = _create_shift_types(client)
    plan = _create_plan(client, list(st.values()))

    r = client.post(
        f"/api/plans/{plan['id']}/apply",
        json={"proposed_assignments": [], "unbekannt": True},
    )
    assert r.status_code == 422
