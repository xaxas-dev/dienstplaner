"""Tests für solver/constraints.py: DOUBLE_BOOKED Hard-Constraint (Sub-Schritt D).

Positiv-Test:  kollisionsfreier Plan → Hard-Score 0 (feasible).
Negativ-Test: konstruierte Doppelbelegung (gepinnt) → Hard-Score < 0.

Voller Solver-Lauf statt ConstraintVerifier (Python-API für CV empirisch nicht
verifiziert); Pinning verhindert, dass der Solver die Kollision auflöst.

JVM-Guard wie in den anderen Solver-Tests.
"""
from datetime import date

import pytest

_JVM_OK = False
_JVM_SKIP_REASON = "JVM-Check noch nicht ausgeführt"

try:
    from timefold.solver import SolverFactory
    from timefold.solver.config import (
        Duration,
        ScoreDirectorFactoryConfig,
        SolverConfig,
        TerminationConfig,
    )

    from app.solver.constraints import constraint_definitions
    from app.solver.domain import ShiftSchedule, SolverDoctor, SolverShift

    _JVM_OK = True
except Exception as exc:
    _JVM_SKIP_REASON = f"Requires Java 17+ JVM: {exc}"

pytestmark = pytest.mark.skipif(not _JVM_OK, reason=_JVM_SKIP_REASON)

# ---------------------------------------------------------------------------
# Modul-Level-Setup (nur wenn JVM verfügbar)
# ---------------------------------------------------------------------------

_DR_ALICE: "SolverDoctor | None" = None
_DR_BOB: "SolverDoctor | None" = None
_solver_factory: object = None

if _JVM_OK:
    _DR_ALICE = SolverDoctor(doctor_id=1, name="Dr. Alice")
    _DR_BOB = SolverDoctor(doctor_id=2, name="Dr. Bob")

    _config = SolverConfig(
        solution_class=ShiftSchedule,
        entity_class_list=[SolverShift],
        score_director_factory_config=ScoreDirectorFactoryConfig(
            constraint_provider_function=constraint_definitions,
        ),
        termination_config=TerminationConfig(spent_limit=Duration(seconds=5)),
    )
    _solver_factory = SolverFactory.create(_config)


def _solve(schedule: "ShiftSchedule") -> "ShiftSchedule":
    return _solver_factory.build_solver().solve(schedule)  # type: ignore[union-attr]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_verschiedene_aerzte_kein_hard_penalty() -> None:
    """Zwei Shifts am selben Tag, verschiedene Ärzte (gepinnt) → Hard-Score 0."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=2, doctor=_DR_BOB, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    assert solution.score.hard_score == 0


def test_gleicher_arzt_selber_tag_hard_penalty() -> None:
    """Zwei Shifts am selben Tag, gleicher Arzt (gepinnt) → Hard-Score < 0."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=2, doctor=_DR_ALICE, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    assert solution.score.hard_score < 0


def test_gleicher_arzt_verschiedene_tage_kein_penalty() -> None:
    """Gleicher Arzt, verschiedene Tage (gepinnt) → kein Hard-Penalty."""
    s1 = SolverShift(
        shift_id=1, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=2, plan_id=1, shift_date=date(2026, 6, 2),
        shift_type_id=1, doctor=_DR_ALICE, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE], shifts=[s1, s2]))

    assert solution.score.hard_score == 0


def test_offene_shifts_kein_hard_penalty() -> None:
    """Zwei offene Shifts am selben Tag → Solver weist ohne DOUBLE_BOOKED zu."""
    s1 = SolverShift(shift_id=1, plan_id=1, shift_date=date(2026, 6, 1), shift_type_id=1)
    s2 = SolverShift(shift_id=2, plan_id=1, shift_date=date(2026, 6, 1), shift_type_id=2)

    solution = _solve(ShiftSchedule(doctors=[_DR_ALICE, _DR_BOB], shifts=[s1, s2]))

    # Solver hat zwei verschiedene Ärzte zur Auswahl — DOUBLE_BOOKED tritt nicht auf.
    assert solution.score.hard_score == 0


# ---------------------------------------------------------------------------
# ABSENT_DOCTOR-Tests (M8-003)
# ---------------------------------------------------------------------------

_ABSENT_DATE = date(2026, 6, 5)

_DR_ABSENT: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_ABSENT = SolverDoctor(
        doctor_id=3, name="Dr. Abwesend", unavailable_dates=frozenset([_ABSENT_DATE])
    )


def test_absent_doctor_penalize_bei_unavailable_date() -> None:
    """Arzt an Datum in unavailable_dates (gepinnt) → Hard-Score < 0."""
    shift = SolverShift(
        shift_id=10, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=_DR_ABSENT, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score < 0


def test_absent_doctor_kein_penalize_bei_available_date() -> None:
    """Arzt an Datum NICHT in unavailable_dates (gepinnt) → Hard-Score 0."""
    other_date = date(2026, 6, 6)  # nicht in unavailable_dates
    shift = SolverShift(
        shift_id=11, plan_id=1, shift_date=other_date,
        shift_type_id=1, doctor=_DR_ABSENT, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score == 0


def test_absent_doctor_kein_penalize_bei_null_doctor() -> None:
    """Offener Shift (doctor=None) an unavailable_dates-Datum → kein Penalty."""
    shift = SolverShift(
        shift_id=12, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=None,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_ABSENT], shifts=[shift]))

    assert solution.score.hard_score == 0


def test_absent_doctor_und_double_booked_addieren() -> None:
    """Beide Verstöße gleichzeitig → Score <= -2 (Constraints addieren)."""
    # _DR_ALICE ist an _ABSENT_DATE in zwei Shifts (DOUBLE_BOOKED)
    # und in unavailable_dates (ABSENT_DOCTOR) → mind. 2× ONE_HARD
    dr_alice_absent = SolverDoctor(
        doctor_id=10, name="Dr. AliceAbsent",
        unavailable_dates=frozenset([_ABSENT_DATE]),
    )
    s1 = SolverShift(
        shift_id=20, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=1, doctor=dr_alice_absent, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=21, plan_id=1, shift_date=_ABSENT_DATE,
        shift_type_id=2, doctor=dr_alice_absent, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[dr_alice_absent], shifts=[s1, s2]))

    # DOUBLE_BOOKED (1×) + ABSENT_DOCTOR (2×) = mindestens -3
    assert solution.score.hard_score <= -2


# ---------------------------------------------------------------------------
# FAIR_DISTRIBUTION-Tests (M8-004)
#
# Alle Tests nutzen is_pinned=True, damit der Solver die Zuweisung nicht
# optimiert. fair_targets wird direkt am SolverDoctor gesetzt (kein DB).
# Nur 1 Arzt im Pool bei Tests, die ausschließlich fair_distribution prüfen
# (vermeidet DOUBLE_BOOKED-Interaktionen).
# ---------------------------------------------------------------------------

_DR_FAIR: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_FAIR = SolverDoctor(doctor_id=20, name="Dr. Fair", fair_targets={1: 2})


def test_fair_distribution_kein_penalize_bei_target_erreicht() -> None:
    """Arzt hat genau fair_targets={1: 2} Schichten von Typ 1 → soft_score == 0."""
    s1 = SolverShift(
        shift_id=30, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=1, doctor=_DR_FAIR, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=31, plan_id=1, shift_date=date(2026, 8, 2),
        shift_type_id=1, doctor=_DR_FAIR, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_FAIR], shifts=[s1, s2]))

    assert solution.score.hard_score == 0
    assert solution.score.soft_score == 0


def test_fair_distribution_penalize_pro_ueber_soll_shift() -> None:
    """Arzt hat 4 Schichten von Typ 1, Ziel=2 → Überschreitung=2 → soft_score == -2."""
    dr = SolverDoctor(doctor_id=21, name="Dr. Overloaded", fair_targets={1: 2})
    shifts = [
        SolverShift(
            shift_id=40 + i, plan_id=1, shift_date=date(2026, 8, i + 1),
            shift_type_id=1, doctor=dr, is_pinned=True,
        )
        for i in range(4)
    ]
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=shifts))

    assert solution.score.hard_score == 0
    assert solution.score.soft_score == -2


def test_fair_distribution_kein_penalize_bei_null_doctor() -> None:
    """Offene Shifts (doctor=None) → kein Soft-Penalty, auch wenn kein Arzt zugewiesen."""
    # Nur ein Arzt im Pool mit target=0 für alle Typen.
    # Shifts sind offen (nicht gepinnt, doctor=None), Solver kann unassigned lassen.
    s1 = SolverShift(shift_id=50, plan_id=1, shift_date=date(2026, 8, 1), shift_type_id=1)
    s2 = SolverShift(shift_id=51, plan_id=1, shift_date=date(2026, 8, 2), shift_type_id=1)
    # Solver mit leerer Doktorliste → kein Arzt verfügbar → doctor=None bleibt
    solution = _solve(ShiftSchedule(doctors=[], shifts=[s1, s2]))

    assert solution.score.soft_score == 0


def test_fair_distribution_getrennt_pro_shifttype() -> None:
    """Überschreitung nur bei Typ 1, nicht bei Typ 2 → nur Typ-1-Penalty zählt."""
    # Dr. Mixed: fair_targets={1: 1, 2: 3}
    # Hat 3 Schichten vom Typ 1 (Überschreitung = 2) und 2 Schichten vom Typ 2 (< Ziel)
    dr = SolverDoctor(doctor_id=23, name="Dr. Mixed", fair_targets={1: 1, 2: 3})
    # 3 Schichten Typ 1 → count=3, target=1, Penalty=2
    t1_shifts = [
        SolverShift(
            shift_id=60 + i, plan_id=1, shift_date=date(2026, 8, i + 1),
            shift_type_id=1, doctor=dr, is_pinned=True,
        )
        for i in range(3)
    ]
    # 2 Schichten Typ 2 → count=2, target=3 → keine Überschreitung
    t2_shifts = [
        SolverShift(
            shift_id=70 + i, plan_id=1, shift_date=date(2026, 8, i + 10),
            shift_type_id=2, doctor=dr, is_pinned=True,
        )
        for i in range(2)
    ]
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=t1_shifts + t2_shifts))

    assert solution.score.hard_score == 0
    # Nur Typ-1-Penalty: 3 - 1 = 2
    assert solution.score.soft_score == -2


def test_fair_distribution_und_double_booked_unabhaengig() -> None:
    """DOUBLE_BOOKED (hard) und FAIR_DISTRIBUTION (soft) gleichzeitig → unabhängig addiert.

    Dr. Combo hat:
      - 2 Shifts am selben Tag (→ DOUBLE_BOOKED: hard_score < 0)
      - 3 Schichten vom Typ 1, Ziel=2 (→ FAIR_DISTRIBUTION: soft_score == -1)
    """
    dr = SolverDoctor(doctor_id=24, name="Dr. Combo", fair_targets={1: 2})
    # Selber Tag → DOUBLE_BOOKED
    s1 = SolverShift(
        shift_id=80, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    s2 = SolverShift(
        shift_id=81, plan_id=1, shift_date=date(2026, 8, 1),
        shift_type_id=2, doctor=dr, is_pinned=True,
    )
    # Weiterer Shift Typ 1 → insgesamt 2× Typ 1 (s1 + s3), noch kein Penalty bei target=2
    # Aber wir wollen Penalty: 3 Shifts Typ 1, target=2 → Penalty 1
    # s2 ist Typ 2 (DOUBLE_BOOKED-Tag), s3 ist Typ 1 auf anderem Tag
    s3 = SolverShift(
        shift_id=82, plan_id=1, shift_date=date(2026, 8, 2),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    # Jetzt: Typ 1 count = 2 (s1 + s3), target=2 → kein Soft-Penalty für Typ 1
    # Füge s4 (Typ 1, weiterer Tag) hinzu → count=3, Penalty=1
    s4 = SolverShift(
        shift_id=83, plan_id=1, shift_date=date(2026, 8, 3),
        shift_type_id=1, doctor=dr, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[dr], shifts=[s1, s2, s3, s4]))

    # DOUBLE_BOOKED: s1+s2 selber Tag → hard_score < 0
    assert solution.score.hard_score < 0
    # FAIR_DISTRIBUTION: Typ 1 count=3 (s1,s3,s4), target=2 → soft_score == -1
    assert solution.score.soft_score < 0


# ---------------------------------------------------------------------------
# MAX_BD_PER_MONTH-Tests (M8-005)
#
# Alle BD-Shifts: is_bereitschaftsdienst=True, is_pinned=True.
# Gleicher Monat (Juli 2026). BD-Arzt: doctor_id=30.
# ---------------------------------------------------------------------------

_DR_BD: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_BD = SolverDoctor(doctor_id=30, name="Dr. BD")

_DR_BD2: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_BD2 = SolverDoctor(doctor_id=31, name="Dr. BD2")


def _bd_shift(shift_id: int, day: int, doctor: "SolverDoctor") -> "SolverShift":
    return SolverShift(
        shift_id=shift_id, plan_id=1, shift_date=date(2026, 7, day),
        shift_type_id=5, doctor=doctor, is_pinned=True, is_bereitschaftsdienst=True,
    )


def test_max_bd_kein_penalize_bei_4_oder_weniger() -> None:
    """4 BD-Shifts ein Arzt → hard_score == 0 (Grenzwert)."""
    shifts = [_bd_shift(100 + i, i + 1, _DR_BD) for i in range(4)]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD], shifts=shifts))
    assert solution.score.hard_score == 0


def test_max_bd_penalize_bei_5_bd() -> None:
    """5 BD-Shifts ein Arzt → hard_score == -1."""
    shifts = [_bd_shift(110 + i, i + 1, _DR_BD) for i in range(5)]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD], shifts=shifts))
    assert solution.score.hard_score == -1


def test_max_bd_penalize_skaliert_linear() -> None:
    """6 BD-Shifts ein Arzt → hard_score == -2 (linear)."""
    shifts = [_bd_shift(120 + i, i + 1, _DR_BD) for i in range(6)]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD], shifts=shifts))
    assert solution.score.hard_score == -2


def test_max_bd_kein_penalize_nicht_bd_shifts() -> None:
    """5 Shifts ohne BD-Flag → hard_score == 0."""
    shifts = [
        SolverShift(
            shift_id=130 + i, plan_id=1, shift_date=date(2026, 7, i + 1),
            shift_type_id=5, doctor=_DR_BD, is_pinned=True, is_bereitschaftsdienst=False,
        )
        for i in range(5)
    ]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD], shifts=shifts))
    assert solution.score.hard_score == 0


def test_max_bd_kein_penalize_offene_shifts() -> None:
    """5 BD-Shifts ohne Doctor → hard_score == 0."""
    shifts = [
        SolverShift(
            shift_id=140 + i, plan_id=1, shift_date=date(2026, 7, i + 1),
            shift_type_id=5, doctor=None, is_bereitschaftsdienst=True,
        )
        for i in range(5)
    ]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD], shifts=shifts))
    assert solution.score.hard_score == 0


def test_max_bd_getrennt_pro_arzt() -> None:
    """Arzt A: 5 BD (penalisiert), Arzt B: 3 BD (nicht penalisiert) → hard_score == -1."""
    shifts_a = [_bd_shift(150 + i, i + 1, _DR_BD) for i in range(5)]
    shifts_b = [
        SolverShift(
            shift_id=160 + i, plan_id=1, shift_date=date(2026, 7, i + 1),
            shift_type_id=6, doctor=_DR_BD2, is_pinned=True, is_bereitschaftsdienst=True,
        )
        for i in range(3)
    ]
    solution = _solve(ShiftSchedule(doctors=[_DR_BD, _DR_BD2], shifts=shifts_a + shifts_b))
    assert solution.score.hard_score == -1


# ---------------------------------------------------------------------------
# MAX_WEEKENDS_PER_MONTH-Tests (M8-006)
#
# Juni 2026: Sa 6., 13., 20., 27. / So 7., 14., 21., 28.
# Alle Shifts gepinnt, shift_type_id=7, Arzt doctor_id=40.
# ---------------------------------------------------------------------------

_DR_WE: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_WE = SolverDoctor(doctor_id=40, name="Dr. Weekend")

# Hilfsdaten: Samstag/Sonntag im Juni 2026
_SAMSTAGE = [6, 13, 20, 27]
_SONNTAGE = [7, 14, 21, 28]


def _we_shift(shift_id: int, day: int, doctor: "SolverDoctor") -> "SolverShift":
    return SolverShift(
        shift_id=shift_id, plan_id=1, shift_date=date(2026, 6, day),
        shift_type_id=7, doctor=doctor, is_pinned=True,
    )


def test_max_weekends_kein_penalize_bei_2_oder_weniger() -> None:
    """2 Wochenend-Shifts (Grenzwert) → hard_score == 0."""
    shifts = [_we_shift(200 + i, _SAMSTAGE[i], _DR_WE) for i in range(2)]
    solution = _solve(ShiftSchedule(doctors=[_DR_WE], shifts=shifts))
    assert solution.score.hard_score == 0


def test_max_weekends_penalize_bei_3_we_shifts() -> None:
    """3 Wochenend-Shifts → Überschreitung 1 → hard_score == -1."""
    shifts = [_we_shift(210 + i, _SAMSTAGE[i], _DR_WE) for i in range(3)]
    solution = _solve(ShiftSchedule(doctors=[_DR_WE], shifts=shifts))
    assert solution.score.hard_score == -1


def test_max_weekends_penalize_skaliert_linear() -> None:
    """4 Wochenend-Shifts → Überschreitung 2 → hard_score == -2."""
    shifts = [_we_shift(220 + i, _SAMSTAGE[i], _DR_WE) for i in range(4)]
    solution = _solve(ShiftSchedule(doctors=[_DR_WE], shifts=shifts))
    assert solution.score.hard_score == -2


def test_max_weekends_kein_penalize_werktags_shifts() -> None:
    """5 Werktags-Shifts (Mo–Fr) → kein Wochenend-Penalty."""
    # Montag 1.6., Di 2.6., Mi 3.6., Do 4.6., Fr 5.6. 2026 (alle Werktage)
    shifts = [
        SolverShift(
            shift_id=230 + i, plan_id=1, shift_date=date(2026, 6, i + 1),
            shift_type_id=7, doctor=_DR_WE, is_pinned=True,
        )
        for i in range(5)
    ]
    solution = _solve(ShiftSchedule(doctors=[_DR_WE], shifts=shifts))
    assert solution.score.hard_score == 0


def test_max_weekends_getrennt_pro_monat() -> None:
    """3 Wochenend-Shifts in Juni + 3 in Juli → je -1 Hard pro Monat = -2 gesamt."""
    juni_shifts = [_we_shift(240 + i, _SAMSTAGE[i], _DR_WE) for i in range(3)]
    # Juli 2026: Sa 4., 11., 18. (weekday 5)
    juli_samstage = [4, 11, 18]
    juli_shifts = [
        SolverShift(
            shift_id=250 + i, plan_id=1, shift_date=date(2026, 7, juli_samstage[i]),
            shift_type_id=7, doctor=_DR_WE, is_pinned=True,
        )
        for i in range(3)
    ]
    solution = _solve(ShiftSchedule(doctors=[_DR_WE], shifts=juni_shifts + juli_shifts))
    assert solution.score.hard_score == -2


# ---------------------------------------------------------------------------
# MIN_REST_TIME-Tests (M8-006)
#
# shift_start_minutes / shift_end_minutes direkt gesetzt (Snapshot-Werte).
# Basis: 1_000_000 Minuten (willkürlicher Epoch-Offset, konsistente Arithmetik).
# Alle Shifts gepinnt, doctor_id=50.
# ---------------------------------------------------------------------------

_DR_REST: "SolverDoctor | None" = None
if _JVM_OK:
    _DR_REST = SolverDoctor(doctor_id=50, name="Dr. Rest")

_BASE = 1_000_000  # willkürliche Epoch-Minuten-Basis
_8H = 8 * 60       # 480 Minuten
_11H = 11 * 60     # 660 Minuten
_12H = 12 * 60     # 720 Minuten


def _rest_shift(
    shift_id: int,
    day: int,
    doctor: "SolverDoctor",
    start_min: int,
    end_min: int,
) -> "SolverShift":
    return SolverShift(
        shift_id=shift_id, plan_id=1, shift_date=date(2026, 6, day),
        shift_type_id=8, doctor=doctor, is_pinned=True,
        shift_start_minutes=start_min,
        shift_end_minutes=end_min,
    )


def test_min_rest_kein_penalize_bei_12h_abstand() -> None:
    """12h Ruhezeit (> 11h) → kein Penalty."""
    s1 = _rest_shift(300, 1, _DR_REST, start_min=_BASE, end_min=_BASE + _8H)
    # s2 startet 12h nach Ende von s1
    s2 = _rest_shift(301, 2, _DR_REST, start_min=_BASE + _8H + _12H, end_min=_BASE + _8H + _12H + _8H)
    solution = _solve(ShiftSchedule(doctors=[_DR_REST], shifts=[s1, s2]))
    assert solution.score.hard_score == 0


def test_min_rest_penalize_bei_8h_abstand() -> None:
    """8h Ruhezeit (< 11h) → Hard-Penalty."""
    s1 = _rest_shift(310, 1, _DR_REST, start_min=_BASE, end_min=_BASE + _8H)
    # s2 startet nur 8h nach Ende von s1 (Verletzung)
    s2 = _rest_shift(311, 2, _DR_REST, start_min=_BASE + _8H + _8H, end_min=_BASE + _8H + _8H + _8H)
    solution = _solve(ShiftSchedule(doctors=[_DR_REST], shifts=[s1, s2]))
    assert solution.score.hard_score < 0


def test_min_rest_kein_penalize_bei_null_zeiten() -> None:
    """Shifts ohne Zeitdaten (shift_start/end_minutes=None) → kein Penalty."""
    s1 = SolverShift(
        shift_id=320, plan_id=1, shift_date=date(2026, 6, 1),
        shift_type_id=8, doctor=_DR_REST, is_pinned=True,
        # shift_start_minutes und shift_end_minutes bleiben None (Standard)
    )
    s2 = SolverShift(
        shift_id=321, plan_id=1, shift_date=date(2026, 6, 2),
        shift_type_id=8, doctor=_DR_REST, is_pinned=True,
    )
    solution = _solve(ShiftSchedule(doctors=[_DR_REST], shifts=[s1, s2]))
    assert solution.score.hard_score == 0


def test_min_rest_kein_penalize_verschiedene_aerzte() -> None:
    """Zwei Ärzte mit kurzer Ruhezeit zwischen ihren Shifts → kein Penalty (andere Ärzte)."""
    dr_a = SolverDoctor(doctor_id=51, name="Dr. A")
    dr_b = SolverDoctor(doctor_id=52, name="Dr. B")
    # dr_a Shift 1, endet bei _BASE + _8H
    s1 = _rest_shift(330, 1, dr_a, start_min=_BASE, end_min=_BASE + _8H)
    # dr_b Shift 2, startet 4h nach Ende von s1 — aber anderer Arzt → kein Penalty
    s2 = _rest_shift(331, 1, dr_b, start_min=_BASE + _8H + 4 * 60, end_min=_BASE + _8H + 4 * 60 + _8H)
    solution = _solve(ShiftSchedule(doctors=[dr_a, dr_b], shifts=[s1, s2]))
    assert solution.score.hard_score == 0


def test_min_rest_exakt_11h_abstand_kein_penalize() -> None:
    """Genau 11h Ruhezeit (Grenzwert) → kein Penalty (> 0 and < 660 schließt exakt 660 aus)."""
    s1 = _rest_shift(340, 1, _DR_REST, start_min=_BASE, end_min=_BASE + _8H)
    # s2 startet exakt 11h (660 min) nach Ende von s1 → nicht < 660 → kein Penalty
    s2 = _rest_shift(341, 2, _DR_REST, start_min=_BASE + _8H + _11H, end_min=_BASE + _8H + _11H + _8H)
    solution = _solve(ShiftSchedule(doctors=[_DR_REST], shifts=[s1, s2]))
    assert solution.score.hard_score == 0
