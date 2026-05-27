from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.plan import Plan


def test_delete_plan_returns_204(client: TestClient, db: Session):
    plan = Plan(name="Test Plan", valid_from=date(2026, 1, 1), valid_to=date(2026, 1, 31), status="DRAFT")
    db.add(plan)
    db.commit()
    db.refresh(plan)

    response = client.delete(f"/api/plans/{plan.id}")

    assert response.status_code == 204


def test_delete_plan_removes_from_db(client: TestClient, db: Session):
    plan = Plan(name="Test Plan", valid_from=date(2026, 1, 1), valid_to=date(2026, 1, 31), status="DRAFT")
    db.add(plan)
    db.commit()
    db.refresh(plan)
    plan_id = plan.id

    client.delete(f"/api/plans/{plan_id}")

    db.expire_all()
    assert db.get(Plan, plan_id) is None


def test_delete_plan_unknown_id_returns_404(client: TestClient, db: Session):
    response = client.delete("/api/plans/99999")

    assert response.status_code == 404
