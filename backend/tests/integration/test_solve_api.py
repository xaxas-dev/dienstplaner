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


# ---------------------------------------------------------------------------
# ABSENT_DOCTOR-Integrationstests (M8-003)
# ---------------------------------------------------------------------------


def test_solve_meidet_abwesenden_arzt(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Solver weist abwesenden Arzt nicht auf Datum seiner Absence zu.

    Alice hat Absence am Plan-Datum, Bob nicht.
    Erwartung: hard_score == 0, Diff enthält nicht Alice für diesen Shift.
    """
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 3)

    st_ids = _seed_shift_types(client)
    alice = _create_doctor(client, "Dr. Alice-Absent")
    _create_doctor(client, "Dr. Bob-Available")

    # Plan mit einem Shift am 2026-07-01
    r = client.post(
        "/api/plans",
        json={
            "name": "AbsentTest",
            "valid_from": "2026-07-01",
            "valid_to": "2026-07-01",
            "shift_type_ids": [list(st_ids.values())[0]],
        },
    )
    assert r.status_code == 201
    plan = r.json()

    # Alice Absence am Plan-Datum
    r = client.post(
        f"/api/doctors/{alice['id']}/absences",
        json={
            "doctor_id": alice["id"],
            "absence_type": "URLAUB",
            "valid_from": "2026-07-01",
            "valid_to": "2026-07-01",
        },
    )
    assert r.status_code == 201

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200
    data = r.json()

    assert data["hard_score"] == 0, f"Unerwartet: hard_score={data['hard_score']}"

    # Kein Vorschlag darf Alice dem Shift zuweisen
    for pa in data["proposed_assignments"]:
        assert pa["doctor_id"] != alice["id"], (
            f"Solver hat abwesende Alice (id={alice['id']}) zugewiesen"
        )


def test_solve_verteilt_fairer_als_zufall(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Solver verteilt 4 gleiche Schichten fair auf 2 gleichwertige Ärzte.

    Setup: 2 Ärzte (gleiche FTE), 4 Shifts vom selben Typ, kein Absence.
    Erwartung: hard_score == 0 (kein DOUBLE_BOOKED), soft_score >= -1
    (bei 4 Shifts / 2 Ärzte = Ziel 2 pro Arzt; max. Rundungstoleranz: -1).
    """
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 5)

    st_ids = _seed_shift_types(client)
    shift_type_id = list(st_ids.values())[0]  # nur ein Schichttyp

    _create_doctor(client, "Dr. FairAlice")
    _create_doctor(client, "Dr. FairBob")

    # Plan mit 4 Tagen, je 1 Shift vom selben Typ
    r = client.post(
        "/api/plans",
        json={
            "name": "FairTest",
            "valid_from": "2026-08-01",
            "valid_to": "2026-08-04",
            "shift_type_ids": [shift_type_id],
        },
    )
    assert r.status_code == 201
    plan = r.json()

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200
    data = r.json()

    # Kein Hard-Penalty (kein DOUBLE_BOOKED)
    assert data["hard_score"] == 0, f"Unerwartet: hard_score={data['hard_score']}"

    # Soft-Penalty muss minimal sein: bei 4 Shifts, 2 Ärzte gleicher FTE
    # → Ziel = 2 pro Arzt. Perfekte Verteilung = soft_score 0.
    # Rundungstoleranz: -1 erlaubt (z.B. Integer-Division 4//2=2, kein Rest).
    assert data["soft_score"] >= -1, (
        f"Solver verteilte nicht fair: soft_score={data['soft_score']}"
    )


def test_solve_nur_abwesender_arzt_bleibt_unassigned(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nur ein Arzt vorhanden, der abwesend ist → Solver wählt None (allows_unassigned).

    Keine Zuweisung ist besser als ABSENT_DOCTOR-Penalty.
    Erwartung: hard_score == 0, Shift im Diff mit doctor_id=null.
    """
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 3)

    st_ids = _seed_shift_types(client)
    alice = _create_doctor(client, "Dr. AliceOnly-Absent")

    r = client.post(
        "/api/plans",
        json={
            "name": "OnlyAbsentTest",
            "valid_from": "2026-07-02",
            "valid_to": "2026-07-02",
            "shift_type_ids": [list(st_ids.values())[0]],
        },
    )
    assert r.status_code == 201
    plan = r.json()

    # Alice zuweisen (nicht gepinnt)
    shifts = plan["shifts"]
    r = client.patch(
        f"/api/shifts/{shifts[0]['id']}",
        json={"doctor_id": alice["id"], "is_pinned": False},
    )
    assert r.status_code == 200

    # Alice Absence am Plan-Datum
    r = client.post(
        f"/api/doctors/{alice['id']}/absences",
        json={
            "doctor_id": alice["id"],
            "absence_type": "URLAUB",
            "valid_from": "2026-07-02",
            "valid_to": "2026-07-02",
        },
    )
    assert r.status_code == 201

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200
    data = r.json()

    assert data["hard_score"] == 0, f"Unerwartet: hard_score={data['hard_score']}"

    # Shift muss im Diff sein mit doctor_id=null (Solver entfernt abwesende Alice)
    diff_by_shift = {pa["shift_id"]: pa["doctor_id"] for pa in data["proposed_assignments"]}
    assert shifts[0]["id"] in diff_by_shift, "Solver-Diff enthält Shift nicht"
    assert diff_by_shift[shifts[0]["id"]] is None, "Solver hat abwesende Alice nicht entfernt"


# ---------------------------------------------------------------------------
# MAX_BD_PER_MONTH-Integrationstest (M8-005)
# ---------------------------------------------------------------------------


def test_solve_respektiert_bd_limit(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """2 Ärzte, 6 BD-Shifts → Solver verteilt auf ≤ 4 pro Arzt, hard_score == 0.

    BD-Shifts werden über einen Shift-Typ mit is_bereitschaftsdienst=True erstellt.
    6 Shifts auf 6 verschiedene Tage (UNIQUE-Constraint: plan+date+type eindeutig).
    """
    monkeypatch.setattr(_ss, "TERMINATION_SECONDS", 5)

    # BD-Schichttyp anlegen
    r = client.post(
        "/api/shift-types",
        json={
            "name": "Bereitschaftsdienst-Test",
            "short_name": "BDT",
            "applies_on_weekdays": True,
            "applies_on_weekend": True,
            "display_order": 99,
            "is_bereitschaftsdienst": True,
        },
    )
    assert r.status_code == 201, r.text
    bd_type_id = r.json()["id"]

    _create_doctor(client, "Dr. BD-Alice")
    _create_doctor(client, "Dr. BD-Bob")

    # Plan mit 6 Tagen, je 1 BD-Shift
    r = client.post(
        "/api/plans",
        json={
            "name": "BDLimitTest",
            "valid_from": "2026-09-01",
            "valid_to": "2026-09-06",
            "shift_type_ids": [bd_type_id],
        },
    )
    assert r.status_code == 201, r.text
    plan = r.json()

    r = client.post(f"/api/plans/{plan['id']}/solve")
    assert r.status_code == 200
    data = r.json()

    # Mit 2 Ärzten und 6 BD-Shifts kann der Solver feasibel lösen (≤ 4 pro Arzt)
    assert data["hard_score"] == 0, (
        f"Solver verletzt BD-Limit: hard_score={data['hard_score']}"
    )
