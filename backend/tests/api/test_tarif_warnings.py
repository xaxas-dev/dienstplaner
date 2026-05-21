"""Tests für GET /api/plans/{plan_id}/tarif-warnings."""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

import app.solver.tarif_rules as tarif_rules_module
from app.models.plan import Plan, PlanStatus
from app.schemas.tarif_warning import TarifSeverity, TarifWarning


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _make_plan(db: Session) -> Plan:
    p = Plan(
        name="API-Tarif-Testplan",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ---------------------------------------------------------------------------
# Test-Regel (nur in Tests verwendet)
# ---------------------------------------------------------------------------


class _OneWarnRule:
    id = "api-test-warn"
    severity = TarifSeverity.WARNING

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        return [
            TarifWarning(
                rule_id=self.id,
                severity=TarifSeverity.WARNING,
                message="API-Test-Warnung",
            )
        ]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_tarif_warnings_returns_200_with_empty_list(
    client: TestClient, db: Session
) -> None:
    plan = _make_plan(db)
    resp = client.get(f"/api/plans/{plan.id}/tarif-warnings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["plan_id"] == plan.id
    assert body["warnings"] == []
    assert body["warning_count"] == 0


def test_tarif_warnings_returns_404_for_unknown_plan(client: TestClient) -> None:
    resp = client.get("/api/plans/999999/tarif-warnings")
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_tarif_warnings_response_schema_matches_plan_tarif_warnings(
    client: TestClient, db: Session
) -> None:
    plan = _make_plan(db)
    resp = client.get(f"/api/plans/{plan.id}/tarif-warnings")
    body = resp.json()
    assert "plan_id" in body
    assert "warnings" in body
    assert "warning_count" in body
    assert isinstance(body["warnings"], list)
    assert isinstance(body["warning_count"], int)


def test_tarif_warnings_returns_warnings_when_rule_registered(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = _make_plan(db)
    monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [_OneWarnRule()])
    resp = client.get(f"/api/plans/{plan.id}/tarif-warnings")
    assert resp.status_code == 200
    body = resp.json()
    assert body["warning_count"] == 1
    assert body["warnings"][0]["rule_id"] == "api-test-warn"
    assert body["warnings"][0]["severity"] == "warning"
