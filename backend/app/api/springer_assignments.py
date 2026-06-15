from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import springer_repository as repo
from app.repositories import plan_repository as plan_repo
from app.schemas.springer_assignment import SpringerAssignmentCreate, SpringerAssignmentResponse

plan_springer_router = APIRouter(tags=["springer"])
springer_router = APIRouter(tags=["springer"])


@plan_springer_router.get(
    "/plans/{plan_id}/springer-assignments",
    response_model=list[SpringerAssignmentResponse],
)
def list_springer_assignments(plan_id: int, db: Session = Depends(get_db)) -> list:
    if plan_repo.get_plan(db, plan_id) is None:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    return repo.get_by_plan(db, plan_id)


@plan_springer_router.post(
    "/plans/{plan_id}/springer-assignments",
    response_model=SpringerAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
def upsert_springer_assignment(
    plan_id: int,
    body: SpringerAssignmentCreate,
    db: Session = Depends(get_db),
) -> SpringerAssignmentResponse:
    if plan_repo.get_plan(db, plan_id) is None:
        raise HTTPException(status_code=404, detail="Plan nicht gefunden")
    result = repo.upsert(db, plan_id, body)
    db.commit()
    db.refresh(result)
    return result


@springer_router.delete(
    "/springer-assignments/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_springer_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
) -> Response:
    if not repo.delete(db, assignment_id):
        raise HTTPException(status_code=404, detail="Springer-Zuweisung nicht gefunden")
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
