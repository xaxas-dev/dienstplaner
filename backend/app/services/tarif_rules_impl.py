from __future__ import annotations

from datetime import time

from sqlalchemy.orm import Session, joinedload

from app.models.doctor import Doctor
from app.models.shift import Shift
from app.models.shift_type import ShiftType
from app.schemas.tarif_warning import TarifSeverity, TarifWarning
from app.solver.tarif_rules import (
    MAX_BD_PER_MONAT,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    MIN_REST_HOURS,
    ConstraintId,
    get_weekly_hours_limit,
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


class MinRestTimeRule:
    id = ConstraintId.MIN_REST_TIME
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .options(joinedload(Shift.shift_type))
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .all()
        )
        by_doctor: dict[int, list[Shift]] = {}
        for s in shifts:
            by_doctor.setdefault(s.doctor_id, []).append(s)

        min_gap = MIN_REST_HOURS * 60
        warnings: list[TarifWarning] = []
        for doctor_id, doctor_shifts in by_doctor.items():
            sorted_shifts = sorted(
                doctor_shifts,
                key=lambda s: (s.shift_date, s.shift_type.start_time or time.min),
            )
            for i in range(len(sorted_shifts) - 1):
                s1 = sorted_shifts[i]
                s2 = sorted_shifts[i + 1]
                if s1.shift_type.end_time is None or s2.shift_type.start_time is None:
                    continue
                base1 = s1.shift_date.toordinal() * 1440
                end_m = s1.shift_type.end_time.hour * 60 + s1.shift_type.end_time.minute
                start1_m = (
                    s1.shift_type.start_time.hour * 60 + s1.shift_type.start_time.minute
                    if s1.shift_type.start_time
                    else 0
                )
                if end_m < start1_m:  # overnight
                    end_m += 1440
                end_abs = base1 + end_m
                start2_abs = (
                    s2.shift_date.toordinal() * 1440
                    + s2.shift_type.start_time.hour * 60
                    + s2.shift_type.start_time.minute
                )
                gap = start2_abs - end_abs
                if gap < min_gap:
                    warnings.append(
                        TarifWarning(
                            shift_id=s2.id,
                            doctor_id=doctor_id,
                            shift_date=s2.shift_date,
                            rule_id=self.id,
                            severity=self.severity,
                            message=(
                                f"Ruhezeit {gap // 60}h {gap % 60}min"
                                f" < {MIN_REST_HOURS}h (ArbZG §5)"
                            ),
                        )
                    )
        return warnings


class MaxWeeklyHoursRule:
    id = ConstraintId.MAX_WEEKLY_HOURS
    severity = TarifSeverity.CRITICAL

    def evaluate(self, db: Session, plan_id: int) -> list[TarifWarning]:
        shifts = (
            db.query(Shift)
            .options(joinedload(Shift.shift_type))
            .filter(
                Shift.plan_id == plan_id,
                Shift.doctor_id.isnot(None),
            )
            .all()
        )
        doctor_ids = {s.doctor_id for s in shifts}
        doctors: dict[int, Doctor] = {
            d.id: d
            for d in db.query(Doctor).filter(Doctor.id.in_(doctor_ids)).all()
        }
        weekly: dict[tuple[int, int, int], int] = {}
        for s in shifts:
            st = s.shift_type
            if st.start_time is None or st.end_time is None:
                continue
            start_m = st.start_time.hour * 60 + st.start_time.minute
            end_m = st.end_time.hour * 60 + st.end_time.minute
            duration = end_m - start_m
            if duration < 0:
                duration += 1440
            iso = s.shift_date.isocalendar()
            key = (s.doctor_id, iso[0], iso[1])  # JPy-safe: iso[0]=year, iso[1]=week
            weekly[key] = weekly.get(key, 0) + duration

        warnings: list[TarifWarning] = []
        for (doctor_id, iso_year, iso_week), total in weekly.items():
            doctor = doctors.get(doctor_id)
            limit = get_weekly_hours_limit(doctor.opt_out_bd_level if doctor else None)
            if total > limit:
                warnings.append(
                    TarifWarning(
                        shift_id=None,
                        doctor_id=doctor_id,
                        shift_date=None,
                        rule_id=self.id,
                        severity=self.severity,
                        message=(
                            f"KW {iso_week}/{iso_year}: {total // 60}h {total % 60}min"
                            f" > {limit // 60}h Limit (ArbZG §3)"
                        ),
                    )
                )
        return warnings
