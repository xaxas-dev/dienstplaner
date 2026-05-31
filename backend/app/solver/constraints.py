"""ConstraintProvider für ShiftSchedule.

Öffentliche Einstiegspunkte:
  build_constraint_provider(disabled) → constraint_provider-Funktion (Ebene A)
  constraint_definitions → Alias mit leerer disabled-Menge (Rückwärtskompatibilität)

Ebene-A-Override: build_constraint_provider(disabled) lässt Constraints komplett weg.
Ebene-B-Override: SolverDoctor.overridden_constraints (frozenset[str], kein planning entity → safe).
Ebene-C-Override: SolverShift.override_* (bool-Flags, JPy-DeepClone-safe statt frozenset).

JPy-Eigenheit: ConstraintId (StrEnum) darf NICHT innerhalb von Lambdas referenziert werden —
der JVM-Interpreter kann Python-Enum-Klassenattribute nicht auflösen. Constraint-ID-Strings
werden als lokale Variablen VOR dem Lambda-Aufruf gecaptured (z.B. `_cid = str(ConstraintId.X)`).
"""
from __future__ import annotations

from datetime import date as _date

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
    MAX_CONSECUTIVE_DAYS,
    MAX_WEEKEND_SHIFTS_PER_MONTH,
    MIN_REST_HOURS,
    ConstraintId,
)

# Pre-capture ConstraintId-Strings als module-level Konstanten — JPy kann StrEnum-Attribute
# innerhalb von Lambdas nicht auflösen (Klassen-Lookup schlägt im JVM-Interpreter fehl).
_CID_MAX_BD = str(ConstraintId.MAX_BD_PER_MONTH)
_CID_MAX_WEEKENDS = str(ConstraintId.MAX_WEEKENDS_PER_MONTH)
_CID_MIN_REST = str(ConstraintId.MIN_REST_TIME)
_CID_MAX_WEEKLY = str(ConstraintId.MAX_WEEKLY_HOURS)


def _iso_week_key(start_minutes: int) -> tuple[int, int]:
    d = _date.fromordinal(start_minutes // 1440)
    iso = d.isocalendar()
    return (iso[0], iso[1])


def build_constraint_provider(disabled: frozenset[str] = frozenset()):
    """Gibt eine constraint_provider-Funktion zurück.

    Regulatorisch-harte Constraints in `disabled` werden komplett weggelassen (Ebene A).
    Ebene B und C werden per Override-Felder in den Lambdas geprüft.
    """

    @constraint_provider
    def _provider(cf: ConstraintFactory) -> list[Constraint]:
        result: list[Constraint] = [
            double_booked(cf),
            absent_doctor(cf),
            fair_distribution(cf),
            max_consecutive_days(cf),
        ]
        if ConstraintId.MAX_BD_PER_MONTH not in disabled:
            result.append(max_bd_per_month(cf))
        if ConstraintId.MAX_WEEKENDS_PER_MONTH not in disabled:
            result.append(max_weekends_per_month(cf))
        if ConstraintId.MIN_REST_TIME not in disabled:
            result.append(min_rest_time(cf))
        if ConstraintId.MAX_WEEKLY_HOURS not in disabled:
            result.append(max_weekly_hours(cf))
        return result

    return _provider


# Rückwärtskompatibles Alias für bestehende Tests
constraint_definitions = build_constraint_provider()


def double_booked(cf: ConstraintFactory) -> Constraint:
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


def max_consecutive_days(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each_unique_pair(
            SolverShift,
            Joiners.equal(lambda s: s.doctor),
        )
        .filter(
            lambda s1, s2: s1.doctor is not None
            and (
                s2.shift_date_ordinal - s1.shift_date_ordinal == MAX_CONSECUTIVE_DAYS
                or s1.shift_date_ordinal - s2.shift_date_ordinal == MAX_CONSECUTIVE_DAYS
            )
        )
        .penalize(HardSoftScore.ONE_SOFT)
        .as_constraint(ConstraintId.MAX_CONSECUTIVE_DAYS)
    )


def max_bd_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: override_max_bd-Flag am Shift. Ebene B: Doctor ausgenommen."""
    _cid = _CID_MAX_BD
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.is_bereitschaftsdienst
            and not s.override_max_bd
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(
            lambda doc, month, count: count > MAX_BD_PER_MONAT
            and _cid not in doc.overridden_constraints
        )
        .penalize(HardSoftScore.ONE_HARD, lambda doc, month, count: count - MAX_BD_PER_MONAT)
        .as_constraint(ConstraintId.MAX_BD_PER_MONTH)
    )


def max_weekends_per_month(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: override_max_weekends-Flag. Ebene B: Doctor ausgenommen."""
    _cid = _CID_MAX_WEEKENDS
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.shift_date.weekday() in (5, 6)
            and not s.override_max_weekends
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: s.shift_date.month,
            ConstraintCollectors.count(),
        )
        .filter(
            lambda doc, month, count: count > MAX_WEEKEND_SHIFTS_PER_MONTH
            and _cid not in doc.overridden_constraints
        )
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, month, count: count - MAX_WEEKEND_SHIFTS_PER_MONTH,
        )
        .as_constraint(ConstraintId.MAX_WEEKENDS_PER_MONTH)
    )


def min_rest_time(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: override_min_rest-Flag an einer der Schichten → kein Penalty.
    Ebene B: Doctor hat Override → kein Penalty für dieses Paar."""
    _cid = _CID_MIN_REST
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
                and not s1.override_min_rest
                and not s2.override_min_rest
                and _cid not in s1.doctor.overridden_constraints
                and (
                    0 < s2.shift_start_minutes - s1.shift_end_minutes < MIN_REST_HOURS * 60
                    or 0 < s1.shift_start_minutes - s2.shift_end_minutes < MIN_REST_HOURS * 60
                )
            )
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.MIN_REST_TIME)
    )


def max_weekly_hours(cf: ConstraintFactory) -> Constraint:
    """Regulatorisch-hart. Ebene C: override_max_weekly_hours-Flag. Ebene B: Doctor ausgenommen."""
    _cid = _CID_MAX_WEEKLY
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: (
                s.doctor is not None
                and s.shift_start_minutes is not None
                and s.shift_end_minutes is not None
                and not s.override_max_weekly_hours
            )
        )
        .group_by(
            lambda s: s.doctor,
            lambda s: _iso_week_key(s.shift_start_minutes),
            ConstraintCollectors.sum(lambda s: s.shift_end_minutes - s.shift_start_minutes),
        )
        .filter(
            lambda doc, week, total_min: total_min > doc.max_weekly_hours_minutes
            and _cid not in doc.overridden_constraints
        )
        .penalize(
            HardSoftScore.ONE_HARD,
            lambda doc, week, total_min: total_min - doc.max_weekly_hours_minutes,
        )
        .as_constraint(ConstraintId.MAX_WEEKLY_HOURS)
    )


def absent_doctor(cf: ConstraintFactory) -> Constraint:
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None and s.shift_date in s.doctor.unavailable_dates
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.ABSENT_DOCTOR)
    )
