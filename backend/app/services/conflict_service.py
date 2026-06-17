from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.repositories import plan_repository, shift_repository
from app.schemas.conflict import ConflictType, OpenShift, PlanConflicts, ShiftConflict
from app.services.exceptions import PlanNotFoundError
from app.services.ina_availability_service import INAAvailability, get_ina_availability


def detect_conflicts(db: Session, plan_id: int) -> PlanConflicts:
    """Berechnet alle Konflikte eines Plans (read-only).

    Raises:
        PlanNotFoundError: plan_id existiert nicht.
    """
    plan = plan_repository.get_plan(db, plan_id)
    if plan is None:
        raise PlanNotFoundError(plan_id)

    shifts = shift_repository.list_shifts_for_plan(db, plan_id)

    occupied = [s for s in shifts if s.doctor_id is not None]

    # Offene Dienste: Shifts in der DB ohne Arzt-Zuweisung.
    open_shifts: list[OpenShift] = [
        OpenShift(
            shift_id=s.id,
            shift_date=s.shift_date,
            shift_type_short_name=s.shift_type.short_name if s.shift_type else "",
        )
        for s in shifts
        if s.doctor_id is None
    ]

    conflicts: list[ShiftConflict] = []

    # Memoization: get_ina_availability pro (doctor_id, date) nur einmal aufrufen
    ina_cache: dict[tuple[int, date], INAAvailability] = {}

    for shift in occupied:
        key = (shift.doctor_id, shift.shift_date)
        if key not in ina_cache:
            ina_cache[key] = get_ina_availability(db, shift.doctor_id, shift.shift_date)
        availability = ina_cache[key]
        if not availability.available:
            conflicts.append(
                ShiftConflict(
                    shift_id=shift.id,
                    conflict_type=ConflictType.NOT_AVAILABLE,
                    message=", ".join(availability.reasons),
                    doctor_id=shift.doctor_id,
                    doctor_name=shift.doctor.name if shift.doctor else "",
                    shift_date=shift.shift_date,
                    shift_type_short_name=shift.shift_type.short_name if shift.shift_type else "",
                )
            )

    # DOUBLE_BOOKED: alle beteiligten Shifts markieren (nicht nur die zweite)
    groups: dict[tuple[int, date], list] = defaultdict(list)
    for shift in occupied:
        groups[(shift.doctor_id, shift.shift_date)].append(shift)

    for (doctor_id, shift_date), group in groups.items():
        if len(group) > 1:
            for shift in group:
                others = [
                    s.shift_type.short_name for s in group if s.id != shift.id and s.shift_type
                ]
                message = f"Mehrfachzuweisung am {shift_date}: auch {', '.join(others)}"
                conflicts.append(
                    ShiftConflict(
                        shift_id=shift.id,
                        conflict_type=ConflictType.DOUBLE_BOOKED,
                        message=message,
                        doctor_id=doctor_id,
                        doctor_name=shift.doctor.name if shift.doctor else "",
                        shift_date=shift_date,
                        shift_type_short_name=(
                            shift.shift_type.short_name if shift.shift_type else ""
                        ),
                    )
                )

    return PlanConflicts(
        plan_id=plan_id,
        conflicts=conflicts,
        conflict_count=len(conflicts),
        open_shifts=open_shifts,
        open_shift_count=len(open_shifts),
    )
