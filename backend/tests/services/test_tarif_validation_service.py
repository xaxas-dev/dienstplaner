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


def test_registered_rules_contains_all_four_prod_rules() -> None:
    """REGISTERED_RULES enthält nach OQ-006-Klärung genau die 4 aktiven Prod-Regeln."""
    from app.services.tarif_rules_impl import (
        MaxBdPerMonthRule,
        MaxWeekendsPerMonthRule,
        MaxWeeklyHoursRule,
        MinRestTimeRule,
    )

    from app.services.tarif_rules_impl import WeekendAroundVacationRule

    rule_types = {type(r) for r in tarif_rules_module.REGISTERED_RULES}
    assert MaxBdPerMonthRule in rule_types
    assert MaxWeekendsPerMonthRule in rule_types
    assert MinRestTimeRule in rule_types
    assert MaxWeeklyHoursRule in rule_types
    assert WeekendAroundVacationRule in rule_types
    assert len(tarif_rules_module.REGISTERED_RULES) == 5


def test_doctor_level_override_suppresses_warning(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Ebene-B-Override (doctor_id + constraint_id) muss Warning unterdrücken."""
    from app.models.doctor import Doctor
    from app.services.constraint_override_service import OverrideSnapshot

    plan = _make_plan(db)
    doctor = Doctor(name="Dr. Override-Test")
    db.add(doctor)
    db.flush()

    class _DoctorWarnRule:
        id = "max-bd-per-month"
        severity = "critical"

        def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
            return [
                TarifWarning(
                    rule_id=self.id,
                    severity=TarifSeverity.CRITICAL,
                    doctor_id=doctor.id,
                    message="BD-Limit überschritten",
                )
            ]

    monkeypatch.setattr(tarif_rules_module, "REGISTERED_RULES", [_DoctorWarnRule()])

    mock_snapshot = OverrideSnapshot(
        doctor_overrides={doctor.id: frozenset(["max-bd-per-month"])}
    )
    monkeypatch.setattr(svc, "get_override_snapshot", lambda _db, _pid: mock_snapshot)

    result = svc.compute_tarif_warnings(db, plan.id)

    assert result.warning_count == 0, "Ebene-B-Override muss Warning unterdrücken"
