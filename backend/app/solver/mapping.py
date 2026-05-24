"""ORM → Solver-Domäne Mapping (read-only).

Einziger öffentlicher Einstiegspunkt: to_solver(db, plan_id) -> ShiftSchedule.
Kein from_solver / Writeback — der /solve-Endpunkt ist Vorschlags-Diff-only.

Liest read-only über bestehende Repositories; keine eigenen DB-Queries.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.repositories.doctor_repository import list_doctors
from app.repositories.shift_repository import list_shifts_for_plan
from app.services.ina_availability_service import get_ina_availability_for_period
from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift


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
    # --- Schichten laden (nötig für Plan-Datum-Range) ---
    orm_shifts = list_shifts_for_plan(db, plan_id)

    # Plan-Datum-Range aus vorhandenen Shifts bestimmen
    if orm_shifts:
        plan_start = min(s.shift_date for s in orm_shifts)
        plan_end = max(s.shift_date for s in orm_shifts)
    else:
        plan_start = plan_end = None

    # --- Ärzte: Werte-Bereich + Availability-Snapshot ---
    orm_doctors = list_doctors(db, include_inactive=False)
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
            doctor_id=d.id, name=d.name, unavailable_dates=unavailable_dates
        )

    # --- Schichten mappen ---
    solver_shifts: list[SolverShift] = []
    for shift in orm_shifts:
        assigned_doctor = (
            solver_doctors.get(shift.doctor_id) if shift.doctor_id is not None else None
        )
        solver_shifts.append(
            SolverShift(
                shift_id=shift.id,
                plan_id=shift.plan_id,
                shift_date=shift.shift_date,
                shift_type_id=shift.shift_type_id,
                doctor=assigned_doctor,
                is_pinned=shift.is_pinned,
            )
        )

    return ShiftSchedule(doctors=list(solver_doctors.values()), shifts=solver_shifts)
