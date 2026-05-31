from datetime import date

from sqlalchemy.orm import Session

from app.models.constraint_override import ConstraintOverride


def get_override(db: Session, override_id: int) -> ConstraintOverride | None:
    return db.get(ConstraintOverride, override_id)


def create_override(db: Session, data: dict) -> ConstraintOverride:
    override = ConstraintOverride(**data)
    db.add(override)
    db.flush()
    db.refresh(override)
    return override


def delete_override(db: Session, override_id: int) -> bool:
    override = db.get(ConstraintOverride, override_id)
    if override is None:
        return False
    db.delete(override)
    db.flush()
    return True


def list_for_plan(
    db: Session,
    plan_id: int,
    plan_start: date,
    plan_end: date,
    shift_ids: set[int],
) -> list[ConstraintOverride]:
    """Alle Overrides relevant für einen Plan: A direkt, B zeitlich aktiv, C per Shift-ID."""
    result: list[ConstraintOverride] = []

    # Ebene A: direkt an plan_id gebunden
    result.extend(
        db.query(ConstraintOverride)
        .filter(ConstraintOverride.level == "A", ConstraintOverride.plan_id == plan_id)
        .all()
    )

    # Ebene B: plan-unabhängig, gültig wenn Zeitraum den Plan überlappt
    result.extend(
        db.query(ConstraintOverride)
        .filter(
            ConstraintOverride.level == "B",
            (ConstraintOverride.valid_from == None)  # noqa: E711
            | (ConstraintOverride.valid_from <= plan_end),
            (ConstraintOverride.valid_to == None)  # noqa: E711
            | (ConstraintOverride.valid_to >= plan_start),
        )
        .all()
    )

    # Ebene C: Shifts die zu diesem Plan gehören
    if shift_ids:
        result.extend(
            db.query(ConstraintOverride)
            .filter(
                ConstraintOverride.level == "C",
                ConstraintOverride.shift_id.in_(shift_ids),
            )
            .all()
        )

    return result


def list_for_doctor(db: Session, doctor_id: int) -> list[ConstraintOverride]:
    return (
        db.query(ConstraintOverride)
        .filter(ConstraintOverride.level == "B", ConstraintOverride.doctor_id == doctor_id)
        .order_by(ConstraintOverride.created_at.desc())
        .all()
    )
