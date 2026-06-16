from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.absences import router as absences_router
from app.api.app_settings import router as app_settings_router
from app.api.constraint_overrides import doctor_overrides_router
from app.api.constraint_overrides import router as constraint_overrides_router
from app.api.departments import router as departments_router
from app.api.doctors import ep_router
from app.api.doctors import router as doctors_router
from app.api.error_handlers import register_error_handlers
from app.api.health import router as health_router
from app.api.holidays import router as holidays_router
from app.api.imports import router as imports_router
from app.api.wishes import doctor_wishes_router, plan_wishes_router, wishes_router
from app.api.ina_exclusions import router as ina_exclusions_router
from app.api.plan_shifts import router as plan_shifts_router
from app.api.springer_assignments import plan_springer_router, springer_router as springer_assignments_router
from app.api.plan_versions import router as plan_versions_router
from app.api.plans import router as plans_router
from app.api.qualifications import router as qualifications_router
from app.api.rotations import plan_rotations_router, rotations_router
from app.api.rule_overrides import router as rule_overrides_router
from app.api.shift_types import router as shift_types_router
from app.api.shifts import router as shifts_router
from app.api.system import router as system_router
from app.api.tarif_warnings import router as tarif_warnings_router
from app.config import BASE_DIR


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    (BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Dienstplaner API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(doctors_router, prefix="/api")
app.include_router(ep_router, prefix="/api")
app.include_router(departments_router, prefix="/api")
app.include_router(shift_types_router, prefix="/api")
app.include_router(qualifications_router, prefix="/api")
app.include_router(rule_overrides_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(plan_versions_router, prefix="/api")
app.include_router(plan_shifts_router, prefix="/api")
app.include_router(shifts_router, prefix="/api")
app.include_router(plan_springer_router, prefix="/api")
app.include_router(springer_assignments_router, prefix="/api")
app.include_router(plan_rotations_router, prefix="/api")
app.include_router(rotations_router, prefix="/api")
app.include_router(ina_exclusions_router, prefix="/api")
app.include_router(absences_router, prefix="/api")
app.include_router(tarif_warnings_router, prefix="/api")
app.include_router(app_settings_router, prefix="/api")
app.include_router(constraint_overrides_router, prefix="/api")
app.include_router(doctor_overrides_router, prefix="/api")
app.include_router(system_router, prefix="/api/system")
app.include_router(holidays_router, prefix="/api")
app.include_router(imports_router, prefix="/api")
app.include_router(doctor_wishes_router, prefix="/api")
app.include_router(wishes_router, prefix="/api")
app.include_router(plan_wishes_router, prefix="/api")
register_error_handlers(app)
