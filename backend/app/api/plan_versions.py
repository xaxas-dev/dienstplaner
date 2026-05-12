from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import plan_version_repository as version_repo
from app.schemas.plan_version import PlanVersionResponse
from app.services import plan_service
from app.services.exceptions import PlanNotFoundError

router = APIRouter(prefix="/plans/{plan_id}/versions", tags=["plan-versions"])


class VersionSnapshotRequest(BaseModel):
    comment: str | None = None


@router.get("", response_model=list[PlanVersionResponse])
def list_versions(plan_id: int, db: Session = Depends(get_db)) -> list:
    return version_repo.list_versions(db, plan_id)


@router.post("", response_model=PlanVersionResponse, status_code=status.HTTP_201_CREATED)
def create_snapshot(plan_id: int, body: VersionSnapshotRequest, db: Session = Depends(get_db)):
    return plan_service.create_version_snapshot(db, plan_id, comment=body.comment)


@router.get("/{version_number}", response_model=PlanVersionResponse)
def get_version(plan_id: int, version_number: int, db: Session = Depends(get_db)):
    pv = version_repo.get_version(db, plan_id, version_number)
    if pv is None:
        raise PlanNotFoundError(plan_id)
    return pv
