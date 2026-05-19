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
