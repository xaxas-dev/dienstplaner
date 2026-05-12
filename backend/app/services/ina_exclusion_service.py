from sqlalchemy.orm import Session

from app.models.ina_exclusion import INAExclusion, INAExclusionReason
from app.repositories import ina_exclusion_repository as repo
from app.services.exceptions import INAExclusionNotFoundError, INAExclusionValidationError


def validate_exclusion_data(data: dict) -> None:
    valid_from = data.get("valid_from")
    valid_to = data.get("valid_to")
    if valid_from is not None and valid_to is not None and valid_from > valid_to:
        raise INAExclusionValidationError("Startdatum darf nicht nach dem Enddatum liegen")
    reason = data.get("reason")
    if reason is not None and reason not in INAExclusionReason.__members__.values():
        raise INAExclusionValidationError(f"Ungültiger Grund: {reason}")


def create_exclusion_with_validation(db: Session, doctor_id: int, data: dict) -> INAExclusion:
    validate_exclusion_data(data)
    excl = repo.create_exclusion(db, doctor_id, data)
    db.commit()
    db.refresh(excl)
    return excl


def update_exclusion_with_validation(db: Session, exclusion_id: int, data: dict) -> INAExclusion:
    excl = repo.get_exclusion(db, exclusion_id)
    if excl is None:
        raise INAExclusionNotFoundError(exclusion_id)

    merged = {
        "valid_from": excl.valid_from,
        "valid_to": excl.valid_to,
        "reason": excl.reason,
        "notes": excl.notes,
    }
    merged.update({k: v for k, v in data.items() if v is not None})
    validate_exclusion_data(merged)

    updated = repo.update_exclusion(db, exclusion_id, data)
    if updated is None:
        raise INAExclusionNotFoundError(exclusion_id)
    db.commit()
    db.refresh(updated)
    return updated
