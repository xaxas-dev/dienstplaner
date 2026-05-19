"""Integration-Tests für POST /api/plans/{id}/solve (Sub-Schritt E).

Testet:
  - 404 für unbekannten Plan
  - Erfolgreicher Solve: Response-Struktur korrekt
  - Gepinnte Shifts nicht in proposed_assignments
  - Kein DOUBLE_BOOKED im Vorschlag
  - DB nach Call unverändert (Diff-only-Nachweis)

JVM-Guard: Tests werden übersprungen wenn kein Java 17+.
"""
import pytest
from fastapi.testclient import TestClient

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    import app.solver.solver_service as _ss
    from app.solver.domain import SolverShift  # noqa: F401 – JVM-Trigger

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _seed_shift_types(client: TestClient) -> dict[str, int]:
    types = [
        {"name": "V-Dienst", "short_name": "V", "applies_on_weekdays": True,
         "applies_on_weekend": False, "display_order": 1},
        {"name": "Nachtdienst", "short_name": "N", "applies_on_weekdays": True,
         "applies_on_weekend": True, "display_order": 2},
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
            "name": "SolveTest",
            "valid_from": "2026-06-01",
            "valid_to": "2026-06-01",
            "shift_type_ids": st_ids,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_solve_plan_404_unknown_plan(client: TestClient) -> None:
    r = client.post("/api/plans/9999/solve")
    assert r.status_code == 404


def test_solve_plan_response_struktur(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Solve liefert gültige SolveResult-Struktur."""
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 2)

    st_ids = _seed_shift_types(client)
    _create_doctor(client, "Dr. Alice")
    _create_doctor(client, "Dr. Bob")
    plan = _create_plan(client, list(st_ids.values()))

    r = client.post(f"/api/plans/{plan['id']}/solve")

    assert r.status_code == 200
    data = r.json()
    assert data["plan_id"] == plan["id"]
    assert "proposed_assignments" in data
    assert "hard_score" in data
    assert "soft_score" in data
    assert "feasible" in data
    assert isinstance(data["hard_score"], int)
    assert isinstance(data["feasible"], bool)


def test_solve_plan_gepinnter_shift_nicht_im_diff(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Gepinnter Shift erscheint nicht in proposed_assignments."""
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 2)

    st_ids = _seed_shift_types(client)
    alice = _create_doctor(client, "Dr. Alice")
    _create_doctor(client, "Dr. Bob")
    plan = _create_plan(client, list(st_ids.values()))

    # Ersten Shift Alice zuweisen und pinnen
    shifts = plan["shifts"]
    shift_to_pin = shifts[0]
    r = client.patch(
        f"/api/shifts/{shift_to_pin['id']}",
        json={"doctor_id": alice["id"], "is_pinned": True},
    )
    assert r.status_code == 200

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200

    diff_shift_ids = {pa["shift_id"] for pa in r.json()["proposed_assignments"]}
    assert shift_to_pin["id"] not in diff_shift_ids


def test_solve_plan_kein_double_booked_im_vorschlag(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Kein Arzt im Vorschlag doppelt am selben Tag zugewiesen."""
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 2)

    st_ids = _seed_shift_types(client)
    _create_doctor(client, "Dr. Alice")
    _create_doctor(client, "Dr. Bob")
    plan = _create_plan(client, list(st_ids.values()))

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200

    # Kein DOUBLE_BOOKED → hard_score == 0
    assert r.json()["hard_score"] == 0


def test_solve_plan_db_unveraendert(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """DB bleibt nach /solve unverändert — Diff-only-Nachweis."""
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 2)

    st_ids = _seed_shift_types(client)
    _create_doctor(client, "Dr. Alice")
    plan = _create_plan(client, list(st_ids.values()))

    # Shifts vor dem Solve abfragen
    shifts_before = client.get(f"/api/plans/{plan['id']}/shifts").json()
    doctor_ids_before = {s["id"]: s["doctor_id"] for s in shifts_before}

    client.post(f"/api/plans/{plan['id']}/solve")

    # Shifts nach dem Solve abfragen — müssen identisch sein
    shifts_after = client.get(f"/api/plans/{plan['id']}/shifts").json()
    doctor_ids_after = {s["id"]: s["doctor_id"] for s in shifts_after}

    assert doctor_ids_before == doctor_ids_after, "DB wurde durch /solve verändert!"
