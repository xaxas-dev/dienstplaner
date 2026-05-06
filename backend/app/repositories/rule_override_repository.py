from datetime import date

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.rule_override import OverrideScope, RuleOverride


def list_rule_overrides(
    db: Session,
    *,
    scope: OverrideScope | None = None,
    doctor_id: int | None = None,
    rule_key: str | None = None,
    active_on_date: date | None = None,
) -> list[RuleOverride]:
    query = db.query(RuleOverride)
    if scope is not None:
        query = query.filter(RuleOverride.scope == scope)
    if doctor_id is not None:
        query = query.filter(RuleOverride.doctor_id == doctor_id)
    if rule_key is not None:
        query = query.filter(RuleOverride.rule_key == rule_key)
    if active_on_date is not None:
        query = query.filter(
            (RuleOverride.valid_from == None) | (RuleOverride.valid_from <= active_on_date)  # noqa: E711
        ).filter(
            (RuleOverride.valid_to == None) | (RuleOverride.valid_to >= active_on_date)  # noqa: E711
        )
    return query.order_by(desc(RuleOverride.created_at)).all()


def get_rule_override(db: Session, override_id: int) -> RuleOverride | None:
    return db.get(RuleOverride, override_id)


def create_rule_override(db: Session, data: dict) -> RuleOverride:
    override = RuleOverride(**data)
    db.add(override)
    db.flush()
    db.refresh(override)
    return override


def update_rule_override(
    db: Session, override_id: int, data: dict
) -> RuleOverride | None:
    override = db.get(RuleOverride, override_id)
    if override is None:
        return None
    for key, value in data.items():
        setattr(override, key, value)
    db.flush()
    db.refresh(override)
    return override


def delete_rule_override(db: Session, override_id: int) -> bool:
    override = db.get(RuleOverride, override_id)
    if override is None:
        return False
    db.delete(override)
    db.flush()
    return True
