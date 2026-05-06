from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.rule_override import OverrideScope
from app.repositories import rule_override_repository as ro_repo
from app.schemas.rule_override import (
    RuleOverrideCreate,
    RuleOverrideResponse,
    RuleOverrideUpdate,
)
from app.services import rule_override_service
from app.services.exceptions import RuleOverrideNotFoundError

router = APIRouter(prefix="/rule-overrides", tags=["rule-overrides"])


@router.get("", response_model=list[RuleOverrideResponse])
def list_rule_overrides(
    scope: OverrideScope | None = None,
    doctor_id: int | None = None,
    rule_key: str | None = None,
    active_on_date: date | None = None,
    db: Session = Depends(get_db),
) -> list:
    return ro_repo.list_rule_overrides(
        db,
        scope=scope,
        doctor_id=doctor_id,
        rule_key=rule_key,
        active_on_date=active_on_date,
    )


@router.get("/{override_id}", response_model=RuleOverrideResponse)
def get_rule_override(override_id: int, db: Session = Depends(get_db)):
    override = ro_repo.get_rule_override(db, override_id)
    if override is None:
        raise RuleOverrideNotFoundError(override_id)
    return override


@router.post(
    "", response_model=RuleOverrideResponse, status_code=status.HTTP_201_CREATED
)
def create_rule_override(body: RuleOverrideCreate, db: Session = Depends(get_db)):
    return rule_override_service.create_rule_override_with_validation(
        db, body.model_dump()
    )


@router.patch("/{override_id}", response_model=RuleOverrideResponse)
def update_rule_override(
    override_id: int, body: RuleOverrideUpdate, db: Session = Depends(get_db)
):
    return rule_override_service.update_rule_override_with_validation(
        db, override_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule_override(override_id: int, db: Session = Depends(get_db)) -> None:
    override = ro_repo.get_rule_override(db, override_id)
    if override is None:
        raise RuleOverrideNotFoundError(override_id)
    ro_repo.delete_rule_override(db, override_id)
    db.commit()
