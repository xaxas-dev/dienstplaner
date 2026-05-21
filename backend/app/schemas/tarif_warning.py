from __future__ import annotations

import enum
from datetime import date

from pydantic import BaseModel


class TarifSeverity(enum.StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class TarifWarning(BaseModel):
    shift_id: int | None = None
    doctor_id: int | None = None
    shift_date: date | None = None
    rule_id: str
    severity: TarifSeverity
    message: str


class PlanTarifWarnings(BaseModel):
    plan_id: int
    warnings: list[TarifWarning]
    warning_count: int
