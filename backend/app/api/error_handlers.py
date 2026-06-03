from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.exceptions import (
    AbsenceNotFoundError,
    AbsenceValidationError,
    ConstraintOverrideNotFoundError,
    ConstraintOverrideValidationError,
    DepartmentNotFoundError,
    DepartmentValidationError,
    DoctorNotFoundError,
    DoctorValidationError,
    DuplicateQualificationError,
    EmploymentPeriodNotFoundError,
    EmploymentPeriodOverlapError,
    INAExclusionNotFoundError,
    INAExclusionValidationError,
    PlanNotFoundError,
    PlanValidationError,
    QualificationInUseError,
    QualificationNotFoundError,
    QualificationValidationError,
    RotationNotFoundError,
    RotationValidationError,
    RuleOverrideNotFoundError,
    RuleOverrideValidationError,
    SettingNotFoundError,
    ShiftNotFoundError,
    ShiftTypeNotFoundError,
    ShiftTypeValidationError,
    ShiftValidationError,
    WishNotFoundError,
)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DoctorNotFoundError)
    async def doctor_not_found(_: Request, exc: DoctorNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(EmploymentPeriodNotFoundError)
    async def ep_not_found(_: Request, exc: EmploymentPeriodNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(QualificationNotFoundError)
    async def qual_not_found(_: Request, exc: QualificationNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(EmploymentPeriodOverlapError)
    async def ep_overlap(_: Request, exc: EmploymentPeriodOverlapError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(DoctorValidationError)
    async def doctor_validation(_: Request, exc: DoctorValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(DuplicateQualificationError)
    async def duplicate_qualification(_: Request, exc: DuplicateQualificationError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(DepartmentNotFoundError)
    async def department_not_found(_: Request, exc: DepartmentNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(DepartmentValidationError)
    async def department_validation(_: Request, exc: DepartmentValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(ShiftTypeNotFoundError)
    async def shift_type_not_found(_: Request, exc: ShiftTypeNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ShiftTypeValidationError)
    async def shift_type_validation(_: Request, exc: ShiftTypeValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(QualificationInUseError)
    async def qualification_in_use(_: Request, exc: QualificationInUseError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(QualificationValidationError)
    async def qualification_validation(
        _: Request, exc: QualificationValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(RuleOverrideNotFoundError)
    async def rule_override_not_found(_: Request, exc: RuleOverrideNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(RuleOverrideValidationError)
    async def rule_override_validation(
        _: Request, exc: RuleOverrideValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(PlanNotFoundError)
    async def plan_not_found(_: Request, exc: PlanNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(PlanValidationError)
    async def plan_validation(_: Request, exc: PlanValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(RotationNotFoundError)
    async def rotation_not_found(_: Request, exc: RotationNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(RotationValidationError)
    async def rotation_validation(_: Request, exc: RotationValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(ShiftNotFoundError)
    async def shift_not_found(_: Request, exc: ShiftNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ShiftValidationError)
    async def shift_validation(_: Request, exc: ShiftValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(INAExclusionNotFoundError)
    async def ina_exclusion_not_found(_: Request, exc: INAExclusionNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(INAExclusionValidationError)
    async def ina_exclusion_validation(
        _: Request, exc: INAExclusionValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(SettingNotFoundError)
    async def setting_not_found(_: Request, exc: SettingNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(AbsenceNotFoundError)
    async def absence_not_found(_: Request, exc: AbsenceNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(AbsenceValidationError)
    async def absence_validation(_: Request, exc: AbsenceValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(ConstraintOverrideNotFoundError)
    async def constraint_override_not_found(
        _: Request, exc: ConstraintOverrideNotFoundError
    ) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ConstraintOverrideValidationError)
    async def constraint_override_validation(
        _: Request, exc: ConstraintOverrideValidationError
    ) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.detail})

    @app.exception_handler(WishNotFoundError)
    async def wish_not_found(_: Request, exc: WishNotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})
