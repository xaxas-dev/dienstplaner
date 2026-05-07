from sqlalchemy.orm import Session

from app.models.rule_override import OverrideScope, RuleOverride
from app.repositories import rule_override_repository as ro_repo
from app.services.exceptions import RuleOverrideNotFoundError, RuleOverrideValidationError


def validate_rule_override_data(data: dict) -> None:
    rule_key = data.get("rule_key", "")
    if not rule_key or not str(rule_key).strip():
        raise RuleOverrideValidationError("rule_key darf nicht leer sein")

    override_value = data.get("override_value", "")
    if not override_value or not str(override_value).strip():
        raise RuleOverrideValidationError("override_value darf nicht leer sein")

    scope = data.get("scope", OverrideScope.GLOBAL)
    doctor_id = data.get("doctor_id")
    if scope == OverrideScope.DOCTOR and doctor_id is None:
        raise RuleOverrideValidationError("doctor_id ist Pflicht wenn scope=DOCTOR")
    if scope == OverrideScope.GLOBAL and doctor_id is not None:
        raise RuleOverrideValidationError("doctor_id muss null sein wenn scope=GLOBAL")

    valid_from = data.get("valid_from")
    valid_to = data.get("valid_to")
    if valid_from is not None and valid_to is not None and valid_from > valid_to:
        raise RuleOverrideValidationError("valid_from darf nicht nach valid_to liegen")


def create_rule_override_with_validation(db: Session, data: dict) -> RuleOverride:
    validate_rule_override_data(data)
    override = ro_repo.create_rule_override(db, data)
    db.commit()
    db.refresh(override)
    return override


def update_rule_override_with_validation(db: Session, override_id: int, data: dict) -> RuleOverride:
    override = ro_repo.get_rule_override(db, override_id)
    if override is None:
        raise RuleOverrideNotFoundError(override_id)

    merged = {
        "rule_key": override.rule_key,
        "override_value": override.override_value,
        "scope": override.scope,
        "doctor_id": override.doctor_id,
        "valid_from": override.valid_from,
        "valid_to": override.valid_to,
    }
    merged.update(data)
    validate_rule_override_data(merged)

    ro_repo.update_rule_override(db, override_id, data)
    db.commit()
    return ro_repo.get_rule_override(db, override_id)  # type: ignore[return-value]
