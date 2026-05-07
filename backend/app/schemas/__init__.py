from app.schemas.absence import AbsenceCreate, AbsenceResponse, AbsenceUpdate
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
)
from app.schemas.doctor import DoctorCreate, DoctorResponse, DoctorUpdate
from app.schemas.doctor_qualification import (
    DoctorQualificationCreate,
    DoctorQualificationResponse,
    DoctorQualificationUpdate,
)
from app.schemas.employment_period import (
    EmploymentPeriodCreate,
    EmploymentPeriodResponse,
    EmploymentPeriodUpdate,
)
from app.schemas.plan import PlanCreate, PlanResponse, PlanUpdate, PlanWithRelations
from app.schemas.plan_version import PlanVersionCreate, PlanVersionResponse
from app.schemas.qualification import (
    QualificationCreate,
    QualificationResponse,
    QualificationUpdate,
)
from app.schemas.rotation_assignment import (
    RotationAssignmentCreate,
    RotationAssignmentResponse,
    RotationAssignmentUpdate,
    RotationAssignmentWithDetails,
)
from app.schemas.rule_override import (
    RuleOverrideCreate,
    RuleOverrideResponse,
    RuleOverrideUpdate,
)
from app.schemas.shift import ShiftCreate, ShiftResponse, ShiftUpdate, ShiftWithDetails
from app.schemas.shift_type import ShiftTypeCreate, ShiftTypeResponse, ShiftTypeUpdate
from app.schemas.wish import WishCreate, WishResponse, WishUpdate

__all__ = [
    "AbsenceCreate",
    "AbsenceResponse",
    "AbsenceUpdate",
    "DepartmentCreate",
    "DepartmentResponse",
    "DepartmentUpdate",
    "DoctorCreate",
    "DoctorQualificationCreate",
    "DoctorQualificationResponse",
    "DoctorQualificationUpdate",
    "DoctorResponse",
    "DoctorUpdate",
    "EmploymentPeriodCreate",
    "EmploymentPeriodResponse",
    "EmploymentPeriodUpdate",
    "PlanCreate",
    "PlanResponse",
    "PlanUpdate",
    "PlanVersionCreate",
    "PlanVersionResponse",
    "PlanWithRelations",
    "QualificationCreate",
    "QualificationResponse",
    "QualificationUpdate",
    "RotationAssignmentCreate",
    "RotationAssignmentResponse",
    "RotationAssignmentUpdate",
    "RotationAssignmentWithDetails",
    "RuleOverrideCreate",
    "RuleOverrideResponse",
    "RuleOverrideUpdate",
    "ShiftCreate",
    "ShiftResponse",
    "ShiftTypeCreate",
    "ShiftTypeResponse",
    "ShiftTypeUpdate",
    "ShiftUpdate",
    "ShiftWithDetails",
    "WishCreate",
    "WishResponse",
    "WishUpdate",
]
