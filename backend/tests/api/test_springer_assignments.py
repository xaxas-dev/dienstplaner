from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.doctor import Doctor, DoctorType
from app.models.plan import Plan
from app.repositories import springer_repository as repo
from app.schemas.springer_assignment import SpringerAssignmentCreate


@pytest.fixture
def plan(db: Session) -> Plan:
    p = Plan(
        name="Testplan",
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 1, 31),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(p)
    db.flush()
    return p


@pytest.fixture
def doctor(db: Session) -> Doctor:
    d = Doctor(
        last_name="Test Arzt",
        short_name="TA",
        doctor_type=DoctorType.INTERNAL,
        active=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_a(db: Session) -> Department:
    d = Department(
        name="Station A",
        short_name="STA",
        active=True,
        display_order=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


@pytest.fixture
def dept_b(db: Session) -> Department:
    d = Department(
        name="Station B",
        short_name="STB",
        active=True,
        display_order=2,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(d)
    db.flush()
    return d


def test_get_by_plan_empty(db: Session, plan: Plan) -> None:
    result = repo.get_by_plan(db, plan.id)
    assert result == []


def test_get_by_plan_nonexistent(db: Session) -> None:
    result = repo.get_by_plan(db, 9999)
    assert result == []


def test_upsert_creates_new(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    data = SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    )
    result = repo.upsert(db, plan.id, data)
    db.commit()
    assert result.id is not None
    assert result.plan_id == plan.id
    assert result.shift_date == date(2026, 1, 15)
    assert result.doctor_id == doctor.id
    assert result.target_department_id == dept_a.id


def test_upsert_updates_existing(
    db: Session, plan: Plan, doctor: Doctor, dept_a: Department, dept_b: Department
) -> None:
    first = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()
    second = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_b.id,
    ))
    db.commit()
    assert second.id == first.id
    assert second.target_department_id == dept_b.id


def test_upsert_two_doctors_same_day(
    db: Session, plan: Plan, dept_a: Department, dept_b: Department
) -> None:
    doctor2 = Doctor(
        last_name="Arzt B", short_name="AB", doctor_type=DoctorType.INTERNAL, active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor2)
    db.flush()
    doctor3 = Doctor(
        last_name="Arzt C", short_name="AC", doctor_type=DoctorType.INTERNAL, active=True,
        created_at=datetime.now(), updated_at=datetime.now(),
    )
    db.add(doctor3)
    db.flush()
    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor2.id, target_department_id=dept_a.id,
    ))
    repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15), doctor_id=doctor3.id, target_department_id=dept_b.id,
    ))
    db.commit()
    results = repo.get_by_plan(db, plan.id)
    assert len(results) == 2


def test_delete_existing(db: Session, plan: Plan, doctor: Doctor, dept_a: Department) -> None:
    sa = repo.upsert(db, plan.id, SpringerAssignmentCreate(
        shift_date=date(2026, 1, 15),
        doctor_id=doctor.id,
        target_department_id=dept_a.id,
    ))
    db.commit()
    ok = repo.delete(db, sa.id)
    db.commit()
    assert ok is True
    assert repo.get_by_plan(db, plan.id) == []


def test_delete_nonexistent(db: Session) -> None:
    assert repo.delete(db, 9999) is False


# ── API-Tests ────────────────────────────────────────────────────────────────

def _make_plan(db: Session, name: str = "ApiTestPlan") -> Plan:
    """Plan direkt per ORM anlegen – vermeidet Abhängigkeit von Schichttypen bei POST /api/plans."""
    p = Plan(
        name=name,
        valid_from=date(2026, 1, 1),
        valid_to=date(2026, 1, 31),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_doctor(client: TestClient) -> dict:
    r = client.post("/api/doctors", json={
        "last_name": "API Arzt", "short_name": "AA", "active": True
    })
    assert r.status_code in (200, 201)
    return r.json()


def _make_dept(client: TestClient, name: str, short_name: str) -> dict:
    r = client.post("/api/departments", json={
        "name": name, "short_name": short_name, "active": True, "display_order": 99
    })
    assert r.status_code in (200, 201)
    return r.json()


def test_api_list_empty(client: TestClient, db: Session) -> None:
    plan = _make_plan(db)
    r = client.get(f"/api/plans/{plan.id}/springer-assignments")
    assert r.status_code == 200
    assert r.json() == []


def test_api_list_unknown_plan(client: TestClient) -> None:
    r = client.get("/api/plans/9999/springer-assignments")
    assert r.status_code == 404


def test_api_upsert_create(client: TestClient, db: Session) -> None:
    plan = _make_plan(db)
    doctor = _make_doctor(client)
    dept = _make_dept(client, "IMC API", "IMCA")

    r = client.post(f"/api/plans/{plan.id}/springer-assignments", json={
        "shift_date": "2026-01-15",
        "doctor_id": doctor["id"],
        "target_department_id": dept["id"],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["doctor_id"] == doctor["id"]
    assert body["target_department"]["id"] == dept["id"]
    assert body["shift_date"] == "2026-01-15"


def test_api_upsert_updates(client: TestClient, db: Session) -> None:
    plan = _make_plan(db)
    doctor = _make_doctor(client)
    dept_a = _make_dept(client, "IMC X", "IMX")
    dept_b = _make_dept(client, "NEU X", "NEX")

    r1 = client.post(f"/api/plans/{plan.id}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept_a["id"],
    })
    assert r1.status_code == 200
    id1 = r1.json()["id"]

    r2 = client.post(f"/api/plans/{plan.id}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept_b["id"],
    })
    assert r2.status_code == 200
    assert r2.json()["id"] == id1
    assert r2.json()["target_department"]["id"] == dept_b["id"]


def test_api_delete(client: TestClient, db: Session) -> None:
    plan = _make_plan(db)
    doctor = _make_doctor(client)
    dept = _make_dept(client, "DEL Dept", "DEL")

    r_create = client.post(f"/api/plans/{plan.id}/springer-assignments", json={
        "shift_date": "2026-01-15", "doctor_id": doctor["id"], "target_department_id": dept["id"],
    })
    assert r_create.status_code == 200
    assignment_id = r_create.json()["id"]

    r_del = client.delete(f"/api/springer-assignments/{assignment_id}")
    assert r_del.status_code == 204

    r_list = client.get(f"/api/plans/{plan.id}/springer-assignments")
    assert r_list.json() == []


def test_api_delete_not_found(client: TestClient) -> None:
    r = client.delete("/api/springer-assignments/9999")
    assert r.status_code == 404
