from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.tarif_warning import PlanTarifWarnings
from app.services import tarif_validation_service

router = APIRouter(prefix="/plans", tags=["tarif-warnings"])


@router.get("/{plan_id}/tarif-warnings", response_model=PlanTarifWarnings)
def get_tarif_warnings(plan_id: int, db: Session = Depends(get_db)) -> PlanTarifWarnings:
    return tarif_validation_service.compute_tarif_warnings(db, plan_id)
