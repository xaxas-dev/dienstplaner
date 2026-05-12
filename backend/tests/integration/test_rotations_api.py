from fastapi.testclient import TestClient


def _seed_shift_types(client: TestClient) -> None:
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
    for t in types:
        r = client.post("/api/shift-types", json=t)
        assert r.status_code == 201, r.text


def _create_plan(client: TestClient) -> dict:
    _seed_shift_types(client)
    r = client.post(
        "/api/plans",
        json={"name": "Rotations-Plan", "valid_from": "2026-04-01", "valid_to": "2026-04-30"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_doctor(client: TestClient, name: str = "Dr. Rotation") -> dict:
    r = client.post("/api/doctors", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_department(client: TestClient, name: str = "SU") -> dict:
    r = client.post("/api/departments", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _create_rotation(
    client: TestClient, plan_id: int, doctor_id: int, dept_id: int, **kwargs
) -> dict:
    payload = {
        "plan_id": plan_id,
        "doctor_id": doctor_id,
        "department_id": dept_id,
        "valid_from": "2026-04-01",
        "valid_to": "2026-04-30",
        **kwargs,
    }
    r = client.post(f"/api/plans/{plan_id}/rotations", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_create_rotation_basic(client: TestClient) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)

    ra = _create_rotation(client, plan["id"], doctor["id"], dept["id"])
    assert ra["doctor_id"] == doctor["id"]
    assert ra["department_id"] == dept["id"]
    assert ra["valid_from"] == "2026-04-01"
    assert ra["valid_to"] == "2026-04-30"


def test_create_rotation_outside_plan_dates_422(client: TestClient) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)

    payload = {
        "plan_id": plan["id"],
        "doctor_id": doctor["id"],
        "department_id": dept["id"],
        "valid_from": "2026-03-01",  # vor Plan-Beginn
        "valid_to": "2026-04-15",
    }
    r = client.post(f"/api/plans/{plan['id']}/rotations", json=payload)
    assert r.status_code == 422


def test_overlapping_rotations_allowed(client: TestClient) -> None:
    """Zwei Rotationen für denselben Arzt/Bereich mit Überschneidung sind erlaubt."""
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)

    _create_rotation(
        client, plan["id"], doctor["id"], dept["id"], valid_from="2026-04-01", valid_to="2026-04-15"
    )
    _create_rotation(
        client, plan["id"], doctor["id"], dept["id"], valid_from="2026-04-10", valid_to="2026-04-30"
    )

    r = client.get(f"/api/plans/{plan['id']}/rotations")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_update_rotation(client: TestClient) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)
    ra = _create_rotation(client, plan["id"], doctor["id"], dept["id"])

    r = client.patch(f"/api/rotations/{ra['id']}", json={"valid_to": "2026-04-15"})
    assert r.status_code == 200
    assert r.json()["valid_to"] == "2026-04-15"


def test_delete_rotation(client: TestClient) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept = _create_department(client)
    ra = _create_rotation(client, plan["id"], doctor["id"], dept["id"])

    r = client.delete(f"/api/rotations/{ra['id']}")
    assert r.status_code == 204

    r_list = client.get(f"/api/plans/{plan['id']}/rotations")
    assert r_list.json() == []
