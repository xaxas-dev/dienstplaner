"""ORM → Solver-Domäne Mapping (read-only).

Einziger öffentlicher Einstiegspunkt: to_solver(db, plan_id) -> ShiftSchedule.
Kein from_solver / Writeback — der /solve-Endpunkt ist Vorschlags-Diff-only.

Liest read-only über bestehende Repositories; keine eigenen DB-Queries.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, time

from sqlalchemy.orm import Session

from app.models.shift_type import ShiftType as ShiftTypeORM
from app.repositories.doctor_repository import list_doctors
from app.repositories.shift_repository import list_shifts_for_plan
from app.services.constraint_override_service import get_override_snapshot
from app.services.employment_period_service import get_fte_for_period
from app.services.ina_availability_service import get_ina_availability_for_period
from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift
from app.solver.tarif_rules import get_weekly_hours_limit


def _time_to_minutes(t: time | None) -> int | None:
    """Konvertiert datetime.time in Minuten seit Mitternacht, None wenn nicht gesetzt."""
    if t is None:
        return None
    return t.hour * 60 + t.minute


def _shift_start_minutes(shift_date: date, start_time: time | None) -> int | None:
    """Absolute Startminuten (Minuten seit Datum-Epoch). None wenn start_time nicht gesetzt."""
    t = _time_to_minutes(start_time)
    if t is None:
        return None
    return shift_date.toordinal() * 1440 + t


def _shift_end_minutes(
    shift_date: date, start_time: time | None, end_time: time | None
) -> int | None:
    """Absolute Endminuten. Overnight-Shifts (end_time < start_time) enden am Folgetag.
    None wenn start_time oder end_time nicht gesetzt (Constraint überspringt dann diesen Shift).
    """
    s = _time_to_minutes(start_time)
    e = _time_to_minutes(end_time)
    if s is None or e is None:
        return None
    base = shift_date.toordinal() * 1440
    # Overnight: Nachtschicht endet nach Mitternacht des Folgetags
    return base + e + (1440 if e < s else 0)


def to_solver(db: Session, plan_id: int) -> ShiftSchedule:
    """Konvertiert alle Schichten eines Plans in ein lösbares ShiftSchedule.

    Ärzte-Werte-Bereich: alle aktiven Ärzte (nicht nur bereits zugewiesene),
    damit der Solver neue Zuweisungen vornehmen kann.
    Gepinnte Schichten ohne Arzt (is_pinned=True, doctor_id=None) werden nicht
    gepinnt übertragen — SolverShift.is_pinned wird in diesem Fall False gesetzt.

    Availability-Snapshot: vor dem Solve wird per Arzt einmalig
    get_ina_availability_for_period aufgerufen und das Ergebnis als
    unavailable_dates (frozenset[date]) in SolverDoctor gespeichert.
    Timefold-Constraints dürfen keine DB-Queries ausführen — der Snapshot
    entkoppelt die Constraint-Logik vom Datenbankzugriff.
    """
    # ShiftType-Maps: alle relevanten Felder einmalig pro Aufruf laden
    all_shift_types = (
        db.query(ShiftTypeORM).filter(ShiftTypeORM.active == True).all()  # noqa: E712
    )
    shift_type_bd_map: dict[int, bool] = {
        st.id: st.is_bereitschaftsdienst for st in all_shift_types
    }
    # Zeitdaten für MIN_REST_TIME-Snapshot (nullable)
    shift_type_times_map: dict[int, tuple[time | None, time | None]] = {
        st.id: (st.start_time, st.end_time) for st in all_shift_types
    }

    # --- Schichten laden (nötig für Plan-Datum-Range) ---
    orm_shifts = list_shifts_for_plan(db, plan_id)

    # Plan-Datum-Range aus vorhandenen Shifts bestimmen
    if orm_shifts:
        plan_start = min(s.shift_date for s in orm_shifts)
        plan_end = max(s.shift_date for s in orm_shifts)
    else:
        plan_start = plan_end = None

    override_snapshot = get_override_snapshot(db, plan_id)

    # --- Ärzte: Werte-Bereich + Availability-Snapshot ---
    orm_doctors = list_doctors(db, include_inactive=False)

    # FTE pro Arzt — einmalig pro Plan abgerufen (nicht pro Schichttyp/Tag)
    if plan_start is None:
        fte_per_doctor = {d.id: 100 for d in orm_doctors}
    else:
        fte_per_doctor = {
            d.id: get_fte_for_period(db, d.id, plan_start, plan_end)
            for d in orm_doctors
        }

    # Shift-Anzahl pro Schichttyp — einmalig für den gesamten Plan
    counts_by_type: Counter[int] = Counter(s.shift_type_id for s in orm_shifts)

    # Gesamt-FTE aller aktiven Ärzte (Nenner für Ziel-Berechnung)
    sum_fte = sum(fte_per_doctor.values())

    def _targets(doctor_id: int) -> dict[int, int]:
        if sum_fte == 0 or not counts_by_type:
            return {}
        fte = fte_per_doctor[doctor_id]
        return {
            st: (count * fte) // sum_fte
            for st, count in counts_by_type.items()
        }

    solver_doctors: dict[int, SolverDoctor] = {}
    for d in orm_doctors:
        if plan_start is not None:
            period = get_ina_availability_for_period(db, d.id, plan_start, plan_end)
            unavailable_dates: frozenset = frozenset(
                dt for dt, avail in period.items() if not avail.available
            )
        else:
            unavailable_dates = frozenset()
        solver_doctors[d.id] = SolverDoctor(
            doctor_id=d.id,
            name=d.name,
            unavailable_dates=unavailable_dates,
            fte_percentage=fte_per_doctor[d.id],
            fair_targets=_targets(d.id),
            max_weekly_hours_minutes=get_weekly_hours_limit(d.opt_out_bd_level),
            overridden_constraints=override_snapshot.doctor_overrides.get(d.id, frozenset()),
        )

    # --- Schichten mappen ---
    solver_shifts: list[SolverShift] = []
    for shift in orm_shifts:
        assigned_doctor = (
            solver_doctors.get(shift.doctor_id) if shift.doctor_id is not None else None
        )
        start_t, end_t = shift_type_times_map.get(shift.shift_type_id, (None, None))
        solver_shifts.append(
            SolverShift(
                shift_id=shift.id,
                plan_id=shift.plan_id,
                shift_date=shift.shift_date,
                shift_type_id=shift.shift_type_id,
                doctor=assigned_doctor,
                is_pinned=shift.is_pinned,
                is_bereitschaftsdienst=shift_type_bd_map.get(shift.shift_type_id, False),
                shift_start_minutes=_shift_start_minutes(shift.shift_date, start_t),
                shift_end_minutes=_shift_end_minutes(shift.shift_date, start_t, end_t),
                overridden_constraints=override_snapshot.shift_overrides.get(shift.id, frozenset()),
            )
        )

    return ShiftSchedule(
        doctors=list(solver_doctors.values()),
        shifts=solver_shifts,
        disabled_constraints=override_snapshot.disabled_constraints,
    )
