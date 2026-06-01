from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity, TarifWarning
from app.solver.tarif_rules import (
    MAX_BD_PER_MONAT,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    ConstraintId,
)


class MaxBdPerMonthRule:
    id = ConstraintId.MAX_BD_PER_MONTH
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .join(ShiftType, Shift.shift_type_id == ShiftType.id)
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
                ShiftType.is_bereitschaftsdienst.is_(True),
            )
            .order_by(Shift.doctor_id, Shift.shift_date)
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            by_doctor.setdefault(s.doctor_id, []).append(s)

        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            for excess in doctor_shifts[MAX_BD_PER_MONAT:]:
                warnings.append(
                    TarifWarning(
                        shift_id=excess.id,
                        doctor_id=doctor_id,
                        shift_date=excess.shift_date,
                        rule_id=self.id,
                        severity=self.severity,
                        message=f"Mehr als {MAX_BD_PER_MONAT} BD/Monat (§ 7 Abs. 5a TV-Ärzte/TdL)",
                    )
                )
        return warnings


class MaxWeekendsPerMonthRule:
    id = ConstraintId.MAX_WEEKENDS_PER_MONTH
    severity = TarifSeverity.WARNING

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .order_by(Shift.doctor_id, Shift.shift_date)
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            if s.shift_date.weekday() in (5, 6):
                by_doctor.setdefault(s.doctor_id, []).append(s)

        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            for excess in doctor_shifts[MAX_WEEKEND_SHIFTS_PER_MONTH:]:
                warnings.append(
                    TarifWarning(
                        shift_id=excess.id,
                        doctor_id=doctor_id,
                        shift_date=excess.shift_date,
                        rule_id=self.id,
                        severity=self.severity,
                        message=f"Mehr als {MAX_WEEKEND_SHIFTS_PER_MONTH} Wochenend-Dienste/Monat",
                    )
                )
        return warnings
