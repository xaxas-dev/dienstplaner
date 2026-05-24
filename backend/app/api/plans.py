from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plan import PlanStatus
from app.repositories import plan_repository as plan_repo
from app.schemas.conflict import PlanConflicts
from app.schemas.dashboard import DashboardSummary
from app.schemas.plan import (
    CloneResult,
    PlanClone,
    PlanCreate,
    PlanResponse,
    PlanUpdate,
    PlanWithRelations,
)
from app.schemas.solve import ApplyRequest, ApplyResult, SolveResult
from app.services import conflict_service, dashboard_service, plan_export_service, plan_service
from app.services.exceptions import PlanNotFoundError

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanResponse])
def list_plans(status: str | None = None, db: Session = Depends(get_db)) -> list:
    plan_status = PlanStatus(status) if status else None
    return plan_repo.list_plans(db, status=plan_status)


@router.get("/current", response_model=PlanWithRelations)
def get_current_plan(today: date | None = None, db: Session = Depends(get_db)):
    """Liefert den neuesten Plan, dessen Zeitraum heute enthält. 204 falls keiner."""
    target = today or date.today()
    plan = plan_repo.get_current_plan(db, target)
    if plan is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return plan


@router.get("/{plan_id}", response_model=PlanWithRelations)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    return plan


@router.post("", response_model=PlanWithRelations, status_code=status.HTTP_201_CREATED)
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    shift_type_ids = body.shift_type_ids
    data = body.model_dump(exclude={"shift_type_ids"})
    return plan_service.create_plan_with_shifts(db, data, shift_type_ids=shift_type_ids)


@router.patch("/{plan_id}", response_model=PlanWithRelations)
def update_plan(plan_id: int, body: PlanUpdate, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        return plan_service.update_plan_status(db, plan_id, data)
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    plan_repo.update_plan(db, plan_id, data)
    db.commit()
    return plan_repo.get_plan(db, plan_id)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: int, db: Session = Depends(get_db)) -> None:
    deleted = plan_repo.delete_plan(db, plan_id)
    if not deleted:
        raise PlanNotFoundError(plan_id)
    db.commit()


@router.post("/{plan_id}/clone", response_model=CloneResult, status_code=status.HTTP_201_CREATED)
def clone_plan(plan_id: int, body: PlanClone, db: Session = Depends(get_db)):
    data = body.model_dump()
    new_plan, copied, skipped = plan_service.clone_plan(db, plan_id, data)
    return CloneResult(plan=new_plan, rotations_copied=copied, rotations_skipped=skipped)


@router.get("/{plan_id}/dashboard", response_model=DashboardSummary)
def get_dashboard_summary(
    plan_id: int,
    today: date | None = None,
    db: Session = Depends(get_db),
) -> DashboardSummary:
    target = today or date.today()
    return dashboard_service.build_dashboard_summary(db, plan_id, target)


@router.get("/{plan_id}/conflicts", response_model=PlanConflicts)
def get_plan_conflicts(plan_id: int, db: Session = Depends(get_db)) -> PlanConflicts:
    return conflict_service.detect_conflicts(db, plan_id)


@router.post("/{plan_id}/solve", response_model=SolveResult)
def solve_plan(plan_id: int, db: Session = Depends(get_db)) -> SolveResult:
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    try:
        from app.solver import solver_service  # Lazy: JVM startet erst beim ersten Aufruf
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Solver nicht verfügbar: {exc}")
    return solver_service.solve_plan(db, plan_id)


_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/{plan_id}/export")
def export_plan(plan_id: int, db: Session = Depends(get_db)) -> StreamingResponse:
    plan = plan_repo.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)
    data = plan_export_service.build_plan_xlsx(db, plan_id)
    filename = plan_export_service.make_filename_slug(plan.name, plan_id)
    return StreamingResponse(
        BytesIO(data),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{plan_id}/apply", response_model=ApplyResult)
def apply_plan(plan_id: int, body: ApplyRequest, db: Session = Depends(get_db)) -> ApplyResult:
    from app.solver import solver_service  # kein JVM-Import, aber konsistenter Importpfad

    return solver_service.apply_solution(db, plan_id, body.proposed_assignments)
