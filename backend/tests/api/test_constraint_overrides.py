from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.plan import Plan
from app.models.shift import Shift
from app.models.shift_type import ShiftType

# A valid regulatorisch-hartes constraint_id (from tarif_rules.REGULATORISCH_HART)
VALID_CONSTRAINT = "max-bd-per-month"
# A logisch-hartes constraint_id that must be rejected
INVALID_CONSTRAINT = "double-booked"


def _make_plan(db: Session, name: str = "Testplan") -> Plan:
    plan = Plan(name=name, valid_from=date(2026, 6, 1), valid_to=date(2026, 6, 30))
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def _make_doctor(db: Session, name: str = "Override-Testarzt") -> Doctor:
    doc = Doctor(last_name=name)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def _make_shift(db: Session, plan: Plan, doctor: Doctor | None = None) -> Shift:
    shift_type = ShiftType(name="Tagdienst-CO", short_name="T-CO")
    db.add(shift_type)
    db.flush()
    shift = Shift(
        plan_id=plan.id,
        shift_date=date(2026, 6, 10),
        shift_type_id=shift_type.id,
        doctor_id=doctor.id if doctor else None,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


class TestCreateConstraintOverrideEbeneA:
    def test_create_level_a_returns_201(self, client: TestClient, db: Session) -> None:
        plan = _make_plan(db)
        payload = {
            "level": "A",
            "constraint_id": VALID_CONSTRAINT,
            "plan_id": plan.id,
            "reason": "Ausnahmeregelung für diesen Plan",
        }
        resp = client.post("/api/constraint-overrides", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["level"] == "A"
        assert data["constraint_id"] == VALID_CONSTRAINT
        assert data["plan_id"] == plan.id
        assert data["reason"] == "Ausnahmeregelung für diesen Plan"
        assert "id" in data
        assert "created_at" in data


class TestCreateConstraintOverrideEbeneB:
    def test_create_level_b_returns_201(self, client: TestClient, db: Session) -> None:
        doc = _make_doctor(db)
        payload = {
            "level": "B",
            "constraint_id": VALID_CONSTRAINT,
            "doctor_id": doc.id,
            "valid_from": "2026-06-01",
            "valid_to": "2026-06-30",
            "reason": "Opt-out vereinbart",
        }
        resp = client.post("/api/constraint-overrides", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["level"] == "B"
        assert data["constraint_id"] == VALID_CONSTRAINT
        assert data["doctor_id"] == doc.id
        assert data["valid_from"] == "2026-06-01"
        assert data["valid_to"] == "2026-06-30"


class TestCreateConstraintOverrideEbeneC:
    def test_create_level_c_returns_201(self, client: TestClient, db: Session) -> None:
        plan = _make_plan(db, "Plan-C-Test")
        shift = _make_shift(db, plan)
        payload = {
            "level": "C",
            "constraint_id": VALID_CONSTRAINT,
            "shift_id": shift.id,
            "reason": "Einzelfall-Ausnahme",
        }
        resp = client.post("/api/constraint-overrides", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["level"] == "C"
        assert data["constraint_id"] == VALID_CONSTRAINT
        assert data["shift_id"] == shift.id


class TestCreateConstraintOverrideValidation:
    def test_logisch_hart_constraint_returns_422(self, client: TestClient, db: Session) -> None:
        plan = _make_plan(db, "Plan-Logisch-Hart")
        payload = {
            "level": "A",
            "constraint_id": INVALID_CONSTRAINT,
            "plan_id": plan.id,
        }
        resp = client.post("/api/constraint-overrides", json=payload)
        assert resp.status_code == 422
        assert "nicht overridebar" in resp.json()["detail"]


class TestDeleteConstraintOverride:
    def test_delete_returns_204(self, client: TestClient, db: Session) -> None:
        plan = _make_plan(db, "Plan-Delete")
        payload = {
            "level": "A",
            "constraint_id": VALID_CONSTRAINT,
            "plan_id": plan.id,
        }
        created = client.post("/api/constraint-overrides", json=payload)
        assert created.status_code == 201
        override_id = created.json()["id"]

        resp = client.delete(f"/api/constraint-overrides/{override_id}")
        assert resp.status_code == 204

    def test_delete_nonexistent_returns_404(self, client: TestClient, db: Session) -> None:
        resp = client.delete("/api/constraint-overrides/99999")
        assert resp.status_code == 404


class TestListConstraintOverrides:
    def test_list_by_plan_id_returns_overrides(self, client: TestClient, db: Session) -> None:
        plan = _make_plan(db, "Plan-List")
        shift = _make_shift(db, plan)
        # Create an Ebene-A override for this plan
        client.post(
            "/api/constraint-overrides",
            json={
                "level": "A",
                "constraint_id": VALID_CONSTRAINT,
                "plan_id": plan.id,
            },
        )
        # Create an Ebene-C override for a shift in this plan
        client.post(
            "/api/constraint-overrides",
            json={
                "level": "C",
                "constraint_id": VALID_CONSTRAINT,
                "shift_id": shift.id,
            },
        )

        resp = client.get(f"/api/constraint-overrides?plan_id={plan.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # At least A and C overrides

    def test_list_by_unknown_plan_returns_empty(self, client: TestClient, db: Session) -> None:
        resp = client.get("/api/constraint-overrides?plan_id=99999")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_without_plan_id_returns_empty(self, client: TestClient, db: Session) -> None:
        resp = client.get("/api/constraint-overrides")
        assert resp.status_code == 200
        assert resp.json() == []
