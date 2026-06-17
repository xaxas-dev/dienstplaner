"""Integration-Tests für GET /api/plans/{id}/absences."""
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.absence import Absence, AbsenceType
from app.models.department import Department
from app.models.rotation_assignment import RotationAssignment


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
    st_id = _seed_shift_type(client)
    r = client.post(
        "/api/plans",
        json={
            "name": "Testplan",
            "valid_from": "2026-05-01",
            "valid_to": "2026-05-31",
            "shift_type_ids": [st_id],
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_doctor(client: TestClient, name: str = "Dr. Test") -> dict:
    r = client.post("/api/doctors", json={"last_name": name})
    assert r.status_code == 201, r.text
    return r.json()


def _seed_rotation(db: Session, plan_id: int, doctor_id: int, dept_id: int) -> None:
    db.add(
        RotationAssignment(
            plan_id=plan_id,
            doctor_id=doctor_id,
            department_id=dept_id,
            valid_from=date(2026, 5, 1),
            valid_to=date(2026, 5, 31),
        )
    )
    db.commit()


def _seed_dept(db: Session) -> int:
    dept = Department(name="ITS", display_order=1)
    db.add(dept)
    db.commit()
    return dept.id


def _seed_absence(
    db: Session,
    doctor_id: int,
    valid_from: date,
    valid_to: date,
    absence_type: AbsenceType = AbsenceType.URLAUB,
) -> int:
    absence = Absence(
        doctor_id=doctor_id,
        absence_type=absence_type,
        valid_from=valid_from,
        valid_to=valid_to,
    )
    db.add(absence)
    db.commit()
    return absence.id


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_plan_absences_404_unknown_plan(client: TestClient) -> None:
    r = client.get("/api/plans/9999/absences")
    assert r.status_code == 404


def test_plan_absences_empty_no_rotations(client: TestClient) -> None:
    plan = _create_plan(client)
    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    assert r.json() == []


def test_plan_absences_empty_no_absences(client: TestClient, db: Session) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept_id = _seed_dept(db)
    _seed_rotation(db, plan["id"], doctor["id"], dept_id)

    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    assert r.json() == []


def test_plan_absences_returns_overlapping_absence(client: TestClient, db: Session) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept_id = _seed_dept(db)
    _seed_rotation(db, plan["id"], doctor["id"], dept_id)
    absence_id = _seed_absence(db, doctor["id"], date(2026, 5, 5), date(2026, 5, 10))

    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["id"] == absence_id
    assert data[0]["doctor_id"] == doctor["id"]
    assert data[0]["absence_type"] == "URLAUB"


def test_plan_absences_excludes_non_rotation_doctor(client: TestClient, db: Session) -> None:
    plan = _create_plan(client)
    doctor_in = _create_doctor(client, "Dr. Rotation")
    doctor_out = _create_doctor(client, "Dr. Ohne-Rotation")
    dept_id = _seed_dept(db)
    _seed_rotation(db, plan["id"], doctor_in["id"], dept_id)
    _seed_absence(db, doctor_out["id"], date(2026, 5, 5), date(2026, 5, 10))

    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    assert r.json() == []


def test_plan_absences_excludes_non_overlapping(client: TestClient, db: Session) -> None:
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept_id = _seed_dept(db)
    _seed_rotation(db, plan["id"], doctor["id"], dept_id)
    # Abwesenheit liegt vollständig nach dem Plan
    _seed_absence(db, doctor["id"], date(2026, 6, 1), date(2026, 6, 15))

    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    assert r.json() == []


def test_plan_absences_partial_overlap_included(client: TestClient, db: Session) -> None:
    """Abwesenheit beginnt vor dem Plan, endet mitten drin → zählt."""
    plan = _create_plan(client)
    doctor = _create_doctor(client)
    dept_id = _seed_dept(db)
    _seed_rotation(db, plan["id"], doctor["id"], dept_id)
    absence_id = _seed_absence(db, doctor["id"], date(2026, 4, 20), date(2026, 5, 5))

    r = client.get(f"/api/plans/{plan['id']}/absences")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == absence_id
