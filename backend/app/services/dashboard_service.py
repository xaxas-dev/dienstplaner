from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.absence import Absence
from app.models.department import Department as DepartmentModel
from app.repositories import plan_repository, shift_repository
from app.schemas.dashboard import (
    AttentionItem,
    AttentionSeverity,
    CoverageBar,
    DashboardKpis,
    DashboardSummary,
    DoctorInfo,
    DutyShift,
)
from app.services import conflict_service
from app.services.exceptions import PlanNotFoundError


def _initials(name: str) -> str:
    parts = name.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper() if name else "?"


def build_dashboard_summary(db: Session, plan_id: int, target_date: date) -> DashboardSummary:
    """Aggregiert alle Dashboard-KPIs für einen Plan an einem Datum.

    Raises:
        PlanNotFoundError: plan_id existiert nicht.
    """
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    shifts = shift_repository.list_shifts_for_plan(db, plan_id)

    # --- KPIs ---
    total_shifts = len(shifts)
    filled_shifts = sum(1 for s in shifts if s.doctor_id is not None)
    coverage_pct = filled_shifts / total_shifts if total_shifts > 0 else 0.0
    open_shifts_count = total_shifts - filled_shifts

    conflict_result = conflict_service.detect_conflicts(db, plan_id)
    conflicts_count = conflict_result.conflict_count

    on_leave_count = (
        db.query(Absence)
        .filter(Absence.valid_from <= target_date, Absence.valid_to >= target_date)
        .count()
    )

    kpis = DashboardKpis(
        coverage_pct=coverage_pct,
        open_shifts=open_shifts_count,
        conflicts=conflicts_count,
        on_leave=on_leave_count,
    )

    # --- Heute im Dienst ---
    today_by_type: dict[int, list] = defaultdict(list)
    for shift in shifts:
        if shift.shift_date == target_date:
            today_by_type[shift.shift_type_id].append(shift)

    # Sortiere nach display_order
    sorted_type_ids = sorted(
        today_by_type.keys(),
        key=lambda tid: next(
            (s.shift_type.display_order for s in today_by_type[tid] if s.shift_type), 999
        ),
    )

    today_shifts: list[DutyShift] = []
    for tid in sorted_type_ids:
        type_shifts = today_by_type[tid]
        first = type_shifts[0]
        st = first.shift_type
        doctors: list[DoctorInfo] = []
        for s in type_shifts:
            if s.doctor:
                doctors.append(
                    DoctorInfo(
                        id=s.doctor.id,
                        name=s.doctor.name,
                        initials=_initials(s.doctor.name),
                    )
                )
        today_shifts.append(
            DutyShift(
                shift_type_name=st.name if st else "",
                shift_type_short_name=st.short_name if st else "",
                time_label=None,
                doctors=doctors,
            )
        )

    # --- Coverage per Department ---
    coverage_by_department: list[CoverageBar] = []
    # max_headcount als Nenner; ra_count als Fallback wenn max_headcount nicht gesetzt
    dept_totals: dict[int, dict] = {}
    for dept in db.query(DepartmentModel).all():
        dept_totals[dept.id] = {
            "name": dept.name,
            "max_headcount": dept.max_headcount,
            "ra_count": 0,
            "filled": 0,
        }

    for ra in plan.rotation_assignments:
        dept_id = ra.department_id
        if dept_id not in dept_totals:
            dept_name = ra.department.name if ra.department else f"Bereich {dept_id}"
            dept_totals[dept_id] = {
                "name": dept_name,
                "max_headcount": None,
                "ra_count": 0,
                "filled": 0,
            }
        dept_totals[dept_id]["ra_count"] += 1
        if ra.valid_from <= target_date <= ra.valid_to:
            dept_totals[dept_id]["filled"] += 1

    for info in sorted(dept_totals.values(), key=lambda d: d["name"]):
        total = info["max_headcount"] if info["max_headcount"] is not None else info["ra_count"]
        filled = info["filled"]
        coverage_by_department.append(
            CoverageBar(
                department_name=info["name"],
                filled=filled,
                total=total,
                pct=filled / total if total > 0 else 0.0,
            )
        )

    # --- Aufmerksamkeit ---
    attention: list[AttentionItem] = []
    tomorrow = target_date + timedelta(days=1)

    # Konflikte heute
    conflicts_today = [c for c in conflict_result.conflicts if c.shift_date == target_date]
    for c in conflicts_today:
        attention.append(
            AttentionItem(
                date=target_date,
                person_name=c.doctor_name or None,
                message=c.message,
                severity=AttentionSeverity.ERROR,
            )
        )

    # Shifts heute ohne Arzt
    for shift in shifts:
        if shift.shift_date == target_date and shift.doctor_id is None:
            st_name = shift.shift_type.short_name if shift.shift_type else "?"
            attention.append(
                AttentionItem(
                    date=target_date,
                    person_name=None,
                    message=f"Schicht {st_name} unbesetzt",
                    severity=AttentionSeverity.WARNING,
                )
            )

    # Absences die morgen beginnen
    upcoming_absences = db.query(Absence).filter(Absence.valid_from == tomorrow).all()
    for absence in upcoming_absences:
        doctor_name = absence.doctor.name if absence.doctor else "Unbekannt"
        attention.append(
            AttentionItem(
                date=tomorrow,
                person_name=doctor_name,
                message=f"Abwesenheit beginnt morgen ({absence.absence_type})",
                severity=AttentionSeverity.INFO,
            )
        )

    return DashboardSummary(
        plan_id=plan_id,
        date=target_date,
        kpis=kpis,
        today_shifts=today_shifts,
        coverage_by_department=coverage_by_department,
        attention=attention,
    )
