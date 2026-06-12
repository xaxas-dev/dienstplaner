"""HTTP-Router für den Besetzungsplan-Excel-Import (Phase A: nur Analyse)."""

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.excel_import import ImportAnalysis
from app.services import import_match_service, import_parse_service

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/besetzungsplan/analyze", response_model=ImportAnalysis)
async def analyze_besetzungsplan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImportAnalysis:
    file_bytes = await file.read()
    parsed = import_parse_service.parse_besetzungsplan(file_bytes)
    return import_match_service.analyze_import(db, parsed)
