# M8-008: MAX_CONSECUTIVE_DAYS Soft-Constraint

## Ziel
Soft-Constraint: Arzt arbeitet möglichst nicht mehr als 5 Tage hintereinander.
Pair-basierter Ansatz: Shifts desselben Arztes mit Ordinal-Differenz == 5 werden bestraft.

## Umfang
- `backend/app/solver/tarif_rules.py`: MAX_CONSECUTIVE_DAYS=5 + ConstraintId + SOFT-frozenset
- `backend/app/solver/domain.py`: SolverShift.shift_date_ordinal (int, in __init__ gesetzt)
- `backend/app/solver/constraints.py`: max_consecutive_days() + Registrierung in constraint_definitions()
- `backend/tests/unit/test_solver_constraints.py`: 4 neue Unit-Tests (doctor_id 42/43, shift_id 200-244)

## Abschluss
- **Datum:** 2026-05-30
- **Branch:** main
- **Commits:**
  - `63956f0` test(solver): M8-008 MAX_CONSECUTIVE_DAYS Unit-Tests (4 Tests)
  - `7bc1470` docs: M8-008 ADR-087 und constraints.md aktualisiert
  - `4dbac82` feat(solver): M8-008 MAX_CONSECUTIVE_DAYS Soft-Constraint
- **Testergebnis:** 37 Tests grün (JVM: Eclipse Temurin 21)
- **ADR:** ADR-087
- **Offene Punkte:** MAX_CONSECUTIVE_DAYS=5 ist Platzhalter — durch Domänenexperten zu bestätigen (analog MAX_WEEKEND_SHIFTS_PER_MONTH)
