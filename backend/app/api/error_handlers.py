from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.exceptions import (
    DoctorNotFoundError,
    DoctorValidationError,
    DuplicateQualificationError,
    EmploymentPeriodNotFoundError,
    EmploymentPeriodOverlapError,
    QualificationNotFoundError,
)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DoctorNotFoundError)
    async def doctor_not_found(_: Request, exc: DoctorNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(EmploymentPeriodNotFoundError)
    async def ep_not_found(
        _: Request, exc: EmploymentPeriodNotFoundError
    ) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(QualificationNotFoundError)
    async def qual_not_found(
        _: Request, exc: QualificationNotFoundError
    ) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(EmploymentPeriodOverlapError)
    async def ep_overlap(_: Request, exc: EmploymentPeriodOverlapError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(DoctorValidationError)
    async def doctor_validation(
        _: Request, exc: DoctorValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(DuplicateQualificationError)
    async def duplicate_qualification(
        _: Request, exc: DuplicateQualificationError
    ) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})
