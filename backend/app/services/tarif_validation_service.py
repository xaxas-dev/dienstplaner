from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories import plan_repository
from app.schemas.tarif_warning import PlanTarifWarnings, TarifWarning
from app.services.exceptions import PlanNotFoundError
from app.solver import tarif_rules as _tarif_rules


def compute_tarif_warnings(db: Session, plan_id: int) -> PlanTarifWarnings:
    """Berechnet alle Tarif-Warnungen eines Plans (read-only).

    Raises:
        PlanNotFoundError: plan_id existiert nicht.
    """
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    warnings: list[TarifWarning] = []
    for rule in _tarif_rules.REGISTERED_RULES:
        warnings.extend(rule.evaluate(db, plan_id))

    return PlanTarifWarnings(
        plan_id=plan_id,
        warnings=warnings,
        warning_count=len(warnings),
    )
