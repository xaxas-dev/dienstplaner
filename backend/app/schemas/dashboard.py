from __future__ import annotations

import enum
from datetime import date

from pydantic import BaseModel


class AttentionSeverity(enum.StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class DashboardKpis(BaseModel):
    coverage_pct: float        # 0.0–1.0, gefüllte Shifts / alle Shifts im Plan
    open_shifts: int           # Shifts im Plan ohne Arzt (gesamt)
    conflicts: int             # Konflikt-Anzahl (read-only, detect_conflicts)
    on_leave: int              # Ärzte mit aktiver Abwesenheit am date


class DoctorInfo(BaseModel):
    id: int
    name: str
    initials: str


class DutyShift(BaseModel):
    shift_type_name: str
    shift_type_short_name: str
    time_label: str | None     # Optional: falls ShiftType-Zeitangaben vorhanden
    doctors: list[DoctorInfo]


class CoverageBar(BaseModel):
    department_name: str
    filled: int    # RAs aktiv am date
    total: int     # Alle RAs für dieses Department im Plan
    pct: float     # filled / total (0.0 wenn total==0)


class AttentionItem(BaseModel):
    date: date
    person_name: str | None
    message: str
    severity: AttentionSeverity


class DashboardSummary(BaseModel):
    plan_id: int
    date: date
    kpis: DashboardKpis
    today_shifts: list[DutyShift]
    coverage_by_department: list[CoverageBar]
    attention: list[AttentionItem]
