from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories import plan_repository
from app.schemas.tarif_warning import PlanTarifWarnings, TarifWarning
from app.services.constraint_override_service import OverrideSnapshot, get_override_snapshot
from app.services.exceptions import PlanNotFoundError
from app.solver import tarif_rules as _tarif_rules


def compute_tarif_warnings(db: Session, plan_id: int) -> PlanTarifWarnings:
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    warnings: list[TarifWarning] = []
    for rule in _tarif_rules.REGISTERED_RULES:
        warnings.extend(rule.evaluate(db, plan_id))

    snapshot = get_override_snapshot(db, plan_id)
    filtered = [w for w in warnings if not _is_overridden(w, snapshot)]

    return PlanTarifWarnings(
        plan_id=plan_id,
        warnings=filtered,
        warning_count=len(filtered),
    )


def _is_overridden(warning: TarifWarning, snapshot: OverrideSnapshot) -> bool:
    cid = warning.rule_id
    if cid in snapshot.disabled_constraints:
        return True
    if warning.shift_id is not None and cid in snapshot.shift_overrides.get(
        warning.shift_id, frozenset()
    ):
        return True
    return False
