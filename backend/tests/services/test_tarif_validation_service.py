"""Unit-Tests für tarif_validation_service.compute_tarif_warnings."""
from datetime import date

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 – alle Modelle registrieren
import app.solver.tarif_rules as tarif_rules_module
from app.models.plan import Plan, PlanStatus
from app.schemas.tarif_warning import TarifSeverity, TarifWarning
from app.services import tarif_validation_service as svc
from app.services.exceptions import PlanNotFoundError

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------


def _make_plan(db: Session) -> Plan:
    p = Plan(
        name="Tarif-Testplan",
        valid_from=date(2026, 6, 1),
        valid_to=date(2026, 6, 30),
        status=PlanStatus.DRAFT,
    )
    db.add(p)
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Test-Regeln (nur in Tests verwendet, nie in REGISTERED_RULES)
# ---------------------------------------------------------------------------


class _AlwaysWarnRule:
    """Gibt immer eine Plan-globale Warnung zurück."""

    id = "test-always-warn"
    severity = TarifSeverity.WARNING

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        return [
            TarifWarning(
                rule_id=self.id,
                severity=TarifSeverity.WARNING,
                message="Test-Warnung",
            )
        ]


class _AlwaysCriticalRule:
    """Gibt immer eine kritische Warnung zurück."""

    id = "test-critical"
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        return [
            TarifWarning(
                rule_id=self.id,
                severity=TarifSeverity.CRITICAL,
                message="Kritische Test-Warnung",
            )
        ]


class _EmptyRule:
    """Gibt immer eine leere Liste zurück."""

    id = "test-empty"
    severity = TarifSeverity.INFO

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        return []


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_empty_registry_returns_empty_warnings(db: Session) -> None:
    plan = _make_plan(db)
    result = svc.compute_tarif_warnings(db, plan.id)
    assert result.plan_id == plan.id
    assert result.warnings == []
    assert result.warning_count == 0


def test_unknown_plan_id_raises_plan_not_found_error(db: Session) -> None:
    with pytest.raises(PlanNotFoundError):
        svc.compute_tarif_warnings(db, 999999)


def test_single_rule_returns_its_warnings(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    plan = _make_plan(db)
    monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [_AlwaysWarnRule()])

    result = svc.compute_tarif_warnings(db, plan.id)
    assert result.warning_count == 1
    assert result.warnings[0].rule_id == "test-always-warn"
    assert result.warnings[0].severity == TarifSeverity.WARNING


def test_pipeline_aggregates_warnings_from_multiple_rules(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = _make_plan(db)
    monkeypatch.setattr(
        tarif_rules_module,
        "REGISTERED_RULES",
        [_AlwaysWarnRule(), _AlwaysCriticalRule()],
    )

    result = svc.compute_tarif_warnings(db, plan.id)
    assert result.warning_count == 2
    rule_ids = {w.rule_id for w in result.warnings}
    assert "test-always-warn" in rule_ids
    assert "test-critical" in rule_ids


def test_rule_returning_empty_list_does_not_break_pipeline(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = _make_plan(db)
    monkeypatch.setattr(
        tarif_rules_module,
        "REGISTERED_RULES",
        [_EmptyRule(), _AlwaysWarnRule()],
    )

    result = svc.compute_tarif_warnings(db, plan.id)
    assert result.warning_count == 1
    assert result.warnings[0].rule_id == "test-always-warn"


def test_warning_count_matches_warnings_list_length(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan = _make_plan(db)
    monkeypatch.setattr(
        tarif_rules_module,
        "REGISTERED_RULES",
        [_AlwaysWarnRule(), _AlwaysWarnRule()],
    )

    result = svc.compute_tarif_warnings(db, plan.id)
    assert result.warning_count == len(result.warnings)


def test_registered_rules_is_empty_in_prod() -> None:
    """Stellt sicher, dass REGISTERED_RULES im Prod-Code leer bleibt."""
    assert tarif_rules_module.REGISTERED_RULES == []
