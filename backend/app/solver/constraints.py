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
from app.solver.tarif_rules import (
    MAX_BD_PER_MONAT,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    MIN_REST_HOURS,
    ConstraintId,
)


@constraint_provider
def constraint_definitions(cf: ConstraintFactory) -> list[Constraint]:
    return [
        double_booked(cf),
        absent_doctor(cf),
        max_bd_per_month(cf),
        max_weekends_per_month(cf),
        min_rest_time(cf),
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


def max_bd_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-harte Constraint: max. 4 BD pro Arzt pro Monat (§ 7 Abs. 5a TV-Ärzte/TdL)."""
    return (
        cf.for_each(SolverShift)
        .filter(lambda s: s.doctor is not None and s.is_bereitschaftsdienst)
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(lambda doc, month, count: count > MAX_BD_PER_MONAT)
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, month, count: count - MAX_BD_PER_MONAT,
        )
        .as_constraint(ConstraintId.MAX_BD_PER_MONTH)
    )


def max_weekends_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-harte Constraint: max. Wochenend-Dienste pro Arzt pro Monat (TV-Ärzte/TdL).

    Wochenende = Samstag (weekday 5) oder Sonntag (weekday 6).
    Limit: MAX_WEEKEND_SHIFTS_PER_MONTH (Platzhalter, noch zu bestätigen).
    """
    return (
        cf.for_each(SolverShift)
        .filter(lambda s: s.doctor is not None and s.shift_date.weekday() in (5, 6))
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(lambda doc, month, count: count > MAX_WEEKEND_SHIFTS_PER_MONTH)
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, month, count: count - MAX_WEEKEND_SHIFTS_PER_MONTH,
        )
        .as_constraint(ConstraintId.MAX_WEEKENDS_PER_MONTH)
    )


def min_rest_time(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-harte Constraint: mindestens 11h Ruhezeit zwischen Diensten (ArbZG §5 Abs. 1).

    Snapshot-Pattern: shift_start_minutes / shift_end_minutes vorberechnet in to_solver().
    Graceful Degradation: ShiftTypes ohne Zeitdaten werden übersprungen (kein Penalty).
    Overnight-Shifts (end_time < start_time) korrekt behandelt (+1440 Minuten in mapping.py).
    for_each_unique_pair liefert ungeordnete Paare — beide Richtungen (s1→s2, s2→s1) geprüft.
    """
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(
            lambda s1, s2: (
                s1.doctor is not None
                and s1.shift_start_minutes is not None
                and s1.shift_end_minutes is not None
                and s2.shift_start_minutes is not None
                and s2.shift_end_minutes is not None
                and (
                    # s2 folgt auf s1, Ruhezeit zu kurz
                    0 < s2.shift_start_minutes - s1.shift_end_minutes < MIN_REST_HOURS * 60
                    # s1 folgt auf s2, Ruhezeit zu kurz
                    or 0 < s1.shift_start_minutes - s2.shift_end_minutes < MIN_REST_HOURS * 60
                )
            )
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.MIN_REST_TIME)
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
