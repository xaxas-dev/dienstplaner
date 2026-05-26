"""ConstraintProvider für ShiftSchedule.

Einziger öffentlicher Einstiegspunkt: constraint_definitions(cf) → list[Constraint].
Wird an ScoreDirectorFactoryConfig(constraint_provider_function=...) übergeben.

Verifizierte API (timefold==1.24.0b0):
  Joiners.equal(key_fn) — Joiner für for_each_unique_pair
  .filter(predicate) — nachträgliche Filterung
  .penalize(HardSoftScore.ONE_HARD) — Hard-Penalty
  .as_constraint(name) — Constraint-ID (StrEnum-Wert ist String)
"""
from __future__ import annotations

from timefold.solver.score import (
    Constraint,
    ConstraintCollectors,
    ConstraintFactory,
    HardSoftScore,
    Joiners,
    constraint_provider,
)

from app.solver.domain import SolverShift
from app.solver.tarif_rules import ConstraintId


@constraint_provider
def constraint_definitions(cf: ConstraintFactory) -> list[Constraint]:
    return [
        double_booked(cf),
        absent_doctor(cf),
        fair_distribution(cf),
    ]


def double_booked(cf: ConstraintFactory) -> Constraint:
    """Logisch-harte Constraint: kein Arzt am selben Tag doppelt eingeplant."""
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.shift_date),
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(lambda s1, s2: s1.doctor is not None)
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.DOUBLE_BOOKED)
    )


def fair_distribution(cf: ConstraintFactory) -> Constraint:
    # group_by(key1, key2, count()) + 3-arg lambda in filter/penalize:
    # verifiziert (timefold==1.24.0b0)
    return (
        cf.for_each(SolverShift)
        .filter(lambda s: s.doctor is not None)
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_type_id,
            ConstraintCollectors.count(),
        )
        .filter(lambda doc, st, count: count > doc.fair_targets.get(st, 0))
        .penalize(
            HardSoftScore.ONE_SOFT,
            lambda doc, st, count: count - doc.fair_targets.get(st, 0),
        )
        .as_constraint(ConstraintId.FAIR_DISTRIBUTION)
    )


def absent_doctor(cf: ConstraintFactory) -> Constraint:
    """Logisch-harte Constraint: Arzt darf nicht an einem Datum eingeplant werden,
    an dem er nach INA-Regeln nicht verfügbar ist (Absence, INAExclusion,
    blockierende Rotation). Verfügbarkeit ist als Snapshot in
    SolverDoctor.unavailable_dates vorberechnet."""
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.shift_date in s.doctor.unavailable_dates
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.ABSENT_DOCTOR)
    )
