"""HTTP-Router für den Besetzungsplan-Excel-Import (Phase A: Analyse, Phase C: Commit)."""

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.excel_import import CommitResolutions, ImportAnalysis, ImportResult
from app.services import import_commit_service, import_match_service, import_parse_service

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/besetzungsplan/analyze", response_model=ImportAnalysis)
async def analyze_besetzungsplan(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImportAnalysis:
    file_bytes = await file.read()
    parsed = import_parse_service.parse_besetzungsplan(file_bytes)
    return import_match_service.analyze_import(db, parsed)


@router.post("/besetzungsplan/commit", response_model=ImportResult)
async def commit_besetzungsplan(
    file: UploadFile = File(...),
    resolutions: str = Form(...),
    db: Session = Depends(get_db),
) -> ImportResult:
    file_bytes = await file.read()
    parsed_resolutions = CommitResolutions.model_validate(json.loads(resolutions))
    return import_commit_service.commit_import(db, file_bytes, parsed_resolutions)
