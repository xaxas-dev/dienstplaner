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
from app.schemas.qualification import (
    QualificationCreate,
    QualificationResponse,
    QualificationUpdate,
)
from app.schemas.rule_override import (
    RuleOverrideCreate,
    RuleOverrideResponse,
    RuleOverrideUpdate,
)
from app.schemas.shift_type import ShiftTypeCreate, ShiftTypeResponse, ShiftTypeUpdate

__all__ = [
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
    "QualificationCreate",
    "QualificationResponse",
    "QualificationUpdate",
    "RuleOverrideCreate",
    "RuleOverrideResponse",
    "RuleOverrideUpdate",
    "ShiftTypeCreate",
    "ShiftTypeResponse",
    "ShiftTypeUpdate",
]
