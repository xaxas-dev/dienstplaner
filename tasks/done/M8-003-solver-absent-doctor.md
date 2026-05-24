# Task M8-003: Solver-Constraint ABSENT_DOCTOR (logisch-hart)

## Ziel

Zweite logisch-harte Solver-Constraint nach `DOUBLE_BOOKED` (M8-001). Der
Solver darf einem Arzt **keine Schicht** an einem Datum zuweisen, an dem
der Arzt nach den drei INA-Quellen (aktive blockierende Rotation,
INAExclusion, Absence) **nicht verfügbar** ist.

**Additiv** — Phase A (manueller Planungsassistent) bleibt vollständig
unangetastet. Die weiche Validierung im Schreibpfad
(`POST /api/shifts/{id}`, `POST /api/plans/{id}/apply`) wird **nicht**
angefasst — User darf weiterhin manuell einen abwesenden Arzt setzen
(ADR-033, ADR M8-002).

**Kernpattern: Availability-Snapshot.** Timefold-Constraints können keine
DB-Queries ausführen. Vor dem Solve wird die Verfügbarkeit aller (Doctor ×
Plan-Datum)-Paare einmalig berechnet und als immutable problem fact
(`SolverDoctor.unavailable_dates: frozenset[date]`) übergeben. Der
Constraint-Filter ist dann ein reiner O(1)-Set-Lookup.

## Bindende Entscheidungen

1. **Constraint-ID:** `ConstraintId.ABSENT_DOCTOR = "absent-doctor"`.
2. **Snapshot-Ort:** `SolverDoctor.unavailable_dates: frozenset[date]`
   (nicht auf `SolverShift`, nicht auf `ShiftSchedule`). Semantisch
   Eigenschaft des Arztes; Lookup im Constraint ist O(1).
3. **Datenquelle:** `get_ina_availability_for_period(db, doctor_id,
   start, end)` aus `services/ina_availability_service.py` **unverändert**
   wiederverwenden. Drei SQL-Queries pro Arzt (Rotation, INAExclusion,
   Absence) statt N×Tage Einzelqueries. NICHT duplizieren (CLAUDE.md).
4. **Plan-Datum-Range:** `min/max(shift.shift_date)` über die
   Plan-Shifts. Leerer Plan → leerer Snapshot, kein Crash.
5. **Constraint-Definition:** `cf.for_each(SolverShift).filter(...)
   .penalize(HardSoftScore.ONE_HARD).as_constraint(ABSENT_DOCTOR)`.
   Pattern analog `double_booked`, eingehängt in
   `constraint_definitions(cf)`.
6. **Apply-Pfad bleibt weich.** Keine Constraint-Prüfung in
   `solver_service.apply_solution`. Decoupling wie ADR M8-002.
7. **`SolverDoctor`-Default:** `unavailable_dates: frozenset[date] =
   frozenset()` als Default-Argument — bestehende Tests, die
   `SolverDoctor(doctor_id, name)` ohne den neuen Parameter
   instanziieren, bleiben grün.

## Kontext (Leseanleitung)

1. `CLAUDE.md` (Phasenmodell, „Weiche Validierung", Timefold-Python-API,
   solver/-Konvention)
2. `docs/constraints.md` (Constraint-Klassen, geplante Constraints)
3. `docs/decisions.md` (ADR-006, ADR-011, ADR-033, ADRs aus M8-001/002)
4. `docs/roadmap.md` (Phase-B-Tabelle: M8-003 = ABSENT_DOCTOR)
5. `backend/app/solver/domain.py` (`SolverDoctor`, `SolverShift`,
   `ShiftSchedule`)
6. `backend/app/solver/mapping.py` (`to_solver(db, plan_id)`)
7. `backend/app/solver/constraints.py` (`constraint_definitions`,
   `double_booked` als Pattern-Vorlage)
8. `backend/app/solver/tarif_rules.py` (`ConstraintId`-StrEnum,
   `LOGISCH_HART`-frozenset, Kommentar Z. 28 für ABSENT_DOCTOR-Stub)
9. `backend/app/services/ina_availability_service.py`
   (`get_ina_availability_for_period`-Signatur)
10. `tasks/done/M8-001-solver-skeleton.md` (Sub-Schritt-Muster)
11. `tasks/done/M8-002-solver-apply-endpoint.md` (Brief-Template-Vorlage)

## Phase-A-Invariante

`git diff main` zeigt ausschließlich additive Änderungen in:
- `backend/app/solver/{domain,mapping,constraints,tarif_rules}.py`
- `backend/tests/unit/test_solver_*.py`
  (Erweiterung; ggf. neue Datei)
- `backend/tests/integration/test_solve_api.py` (Erweiterung)
- `docs/{constraints,decisions,open-questions}.md`, `CLAUDE.md`
- `tasks/open/M8-003-*.md` → `tasks/done/`

Kein Touch an: `conflict_service.py`, `shift_service.py`,
`ina_availability_service.py`, `plan_shifts.py`, `shifts.py`, Modellen,
Migrationen, Frontend.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Constraint-ID + Registry

**Datei:** `backend/app/solver/tarif_rules.py`

- `ConstraintId.ABSENT_DOCTOR = "absent-doctor"` neben `DOUBLE_BOOKED`
  hinzufügen (Kommentar Z. 28 entfernen).
- `LOGISCH_HART` erweitern: `frozenset([ConstraintId.DOUBLE_BOOKED,
  ConstraintId.ABSENT_DOCTOR])`.

**Akzeptanzkriterien A:**
- [x] `ConstraintId.ABSENT_DOCTOR` existiert mit Wert `"absent-doctor"`.
- [x] `LOGISCH_HART` enthält beide Constraint-IDs.
- [x] `ruff check` clean.
- [x] Bestehende Tests grün (kein Mapping/Constraint-Code in diesem Schritt).

**Stop-Gate A:** Commit
`feat(solver): M8-003/A absent-doctor constraint id`, Review.

---

### Sub-Schritt B — `SolverDoctor.unavailable_dates`

**Datei:** `backend/app/solver/domain.py`

- `SolverDoctor.__init__` um Keyword-Default `unavailable_dates:
  frozenset[date] = frozenset()` erweitern.
- Attribut zuweisen, `__repr__` unverändert lassen
  (Snapshot-Inhalt nicht ins Repr aufnehmen — kann groß werden).
- `__eq__` / `__hash__` bleiben auf `doctor_id` — Snapshot beeinflusst
  Identität nicht (zwei `SolverDoctor` mit gleicher `doctor_id`, aber
  unterschiedlichem Snapshot, sind weiterhin gleich).
- Import `date` aus `datetime` falls nicht bereits da.

**Unit-Test** in `backend/tests/unit/test_solver_domain.py` (existiert
oder neu):

| Test | Was wird geprüft |
|------|-----------------|
| `test_solver_doctor_default_unavailable_dates_leer` | Default ist `frozenset()` |
| `test_solver_doctor_eq_ignoriert_unavailable_dates` | Zwei `SolverDoctor` mit gleicher ID + unterschiedlichem Snapshot sind `==` |
| `test_solver_doctor_unavailable_dates_konfigurierbar` | Übergebener `frozenset` landet im Attribut |

**Akzeptanzkriterien B:**
- [x] `SolverDoctor.unavailable_dates` Attribut existiert, Default leer.
- [x] Bestehende `SolverDoctor(doctor_id, name)`-Aufrufe in Tests laufen
      unverändert.
- [x] 3 neue Tests grün.
- [x] `ruff check` clean.

**Stop-Gate B:** Commit
`feat(solver): M8-003/B solver doctor availability field`, Review.

---

### Sub-Schritt C — Snapshot-Berechnung im Mapping

**Datei:** `backend/app/solver/mapping.py`

Erweitere `to_solver(db, plan_id)`:

1. Nach `orm_shifts = list_shifts_for_plan(db, plan_id)` Plan-Datum-Range
   bestimmen:
   ```python
   if orm_shifts:
       plan_start = min(s.shift_date for s in orm_shifts)
       plan_end = max(s.shift_date for s in orm_shifts)
   else:
       plan_start = plan_end = None
   ```
2. Für jeden Arzt aus `orm_doctors`:
   - Wenn `plan_start is None`: `unavailable_dates = frozenset()`.
   - Sonst: `period =
     get_ina_availability_for_period(db, d.id, plan_start, plan_end)`,
     dann `unavailable_dates = frozenset(date for date, avail in
     period.items() if not avail.available)`.
3. `SolverDoctor(doctor_id=d.id, name=d.name,
   unavailable_dates=unavailable_dates)` instanziieren.

Import ergänzen: `from app.services.ina_availability_service import
get_ina_availability_for_period`.

**Unit-Test** in `backend/tests/unit/test_solver_mapping.py` (existiert
oder neu, nutzt echte DB-Fixture wie bisherige Mapping-Tests):

| Test | Was wird geprüft |
|------|-----------------|
| `test_to_solver_snapshot_enthaelt_absence_datum` | Absence im Plan-Range → Datum in `unavailable_dates` |
| `test_to_solver_snapshot_leer_fuer_verfuegbaren_arzt` | Keine Quellen aktiv → leeres frozenset |
| `test_to_solver_snapshot_enthaelt_rotation_datum` | Aktive Rotation auf blockierendem Bereich (Werktag) → Datum drin |
| `test_to_solver_leerer_plan_kein_crash` | Plan ohne Shifts → leerer Snapshot pro Arzt, kein Exception |

**Akzeptanzkriterien C:**
- [x] `to_solver` füllt `unavailable_dates` pro Arzt.
- [x] `get_ina_availability_for_period` wird verwendet (eine Period-Query
      pro Arzt, nicht pro Tag).
- [x] 4 neue Tests grün.
- [x] Bestehende Mapping-Tests grün (Default-Verhalten unverändert).
- [x] `ruff check` clean.

**Stop-Gate C:** Commit
`feat(solver): M8-003/C availability snapshot in mapping`, Review.

---

### Sub-Schritt D — Constraint + Constraint-Tests

**Datei:** `backend/app/solver/constraints.py`

Neue Funktion analog `double_booked`:

```python
def absent_doctor(cf: ConstraintFactory) -> Constraint:
    """Logisch-harte Constraint: Arzt darf an einem Datum, an dem er
    nicht INA-verfügbar ist, keine Schicht haben."""
    return (
        cf.for_each(SolverShift)
        .filter(
            lambda s: s.doctor is not None
            and s.shift_date in s.doctor.unavailable_dates
        )
        .penalize(HardSoftScore.ONE_HARD)
        .as_constraint(ConstraintId.ABSENT_DOCTOR)
    )
```

In `constraint_definitions(cf)` einhängen:
```python
return [
    double_booked(cf),
    absent_doctor(cf),
]
```

**Unit-Test** in `backend/tests/unit/test_solver_constraints.py`
(existiert oder neu — diese Datei darf JVM-Guard nutzen, da
timefold-Import nötig):

| Test | Was wird geprüft |
|------|-----------------|
| `test_absent_doctor_penalize_bei_unavailable_date` | Shift an Datum in `unavailable_dates` mit zugewiesenem Arzt → hard_score < 0 |
| `test_absent_doctor_kein_penalize_bei_available_date` | Shift an Datum NICHT in `unavailable_dates` → hard_score == 0 |
| `test_absent_doctor_kein_penalize_bei_null_doctor` | Offener Shift (doctor=None) → kein Penalty, auch wenn Datum „unavailable" wäre |
| `test_absent_doctor_und_double_booked_unabhaengig` | Beide Verstöße gleichzeitig → 2× ONE_HARD im Score (Constraints addieren) |

**Akzeptanzkriterien D:**
- [x] `absent_doctor` in `constraints.py`, eingehängt in
      `constraint_definitions`.
- [x] 4 Constraint-Tests grün (oder skipped via JVM-Guard wenn Java fehlt
      — analog M8-001-Pattern).
- [x] `double_booked`-Tests aus M8-001 weiterhin grün.
- [x] `ruff check` clean.

**Stop-Gate D:** Commit
`feat(solver): M8-003/D absent-doctor hard constraint + tests`, Review.

---

### Sub-Schritt E — Integrationstest `/solve`

**Datei:** `backend/tests/integration/test_solve_api.py` (existiert seit
M8-001).

Neuer Testfall:

| Test | Was wird geprüft |
|------|-----------------|
| `test_solve_meidet_abwesenden_arzt` | Plan mit zwei Ärzten, einer hat Absence über ein Plan-Datum. `POST /solve` liefert `feasible=True`, `hard_score=0`, im Diff entweder anderer Arzt oder `doctor_id=None` für betroffene Shift |
| `test_solve_unfeasible_wenn_nur_abwesender_arzt` | Plan mit einer Shift + nur einem (abwesenden) Arzt → Solver akzeptiert `doctor=None` als Lösung (`allows_unassigned=True`), `feasible=True`, betroffene Shift im Diff = unassigned |

Beide Tests respektieren JVM-Guard (vorhandenes Pattern in der Datei).

**Akzeptanzkriterien E:**
- [x] 2 neue Integrationstests grün (oder skipped via JVM-Guard).
- [x] Bestehende `/solve`-Tests grün.

**Stop-Gate E:** Commit
`test(solver): M8-003/E solve api skips absent doctor`, Review.

---

### Sub-Schritt F — Abschluss-Dokumentation

Pflichtschritte laut CLAUDE.md-Milestone-Abschluss-Checkliste:

1. **`tasks/open/M8-003-solver-absent-doctor.md`** → `tasks/done/`
   verschieben; alle `[ ]` → `[x]`; Abschnitt „Abschluss" anhängen
   (Datum, Branch, Commit-Liste, Testergebnis).
2. **`docs/open-questions.md`**: ggf. neue Fragen (z. B.
   „Soll Snapshot zwischen mehreren Solves pro Plan gecached werden?")
   eintragen.
3. **`docs/decisions.md`**: neuer ADR „Availability-Snapshot als problem
   fact auf `SolverDoctor`" — Begründung (DB-Verbot im
   ConstraintProvider, O(1)-Lookup, Reuse von
   `get_ina_availability_for_period`).
4. **`docs/constraints.md`**: `absent-doctor`-Zeile in der
   Constraint-Tabelle von „Planned" auf „Implementiert (M8-003)"
   umschalten; Snapshot-Pattern-Hinweis ergänzen.
5. **`docs/roadmap.md`**: M8-003-Zeile in Phase-B-Tabelle auf ✅ setzen
   (Datum, Branch-Name).
6. **`CLAUDE.md`**: Solver-Sektion erweitern um Snapshot-Pattern
   (kurzer Block analog „Solver-Vorschlags-Diff (M8-001)").

**Stop-Gate F:** Commit
`docs: M8-003 abschluss + ADR availability snapshot`, Review.

---

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `ConstraintId.ABSENT_DOCTOR` + `LOGISCH_HART` erweitert
- [x] `SolverDoctor.unavailable_dates: frozenset[date]` mit Default leer
- [x] `to_solver` füllt Snapshot via
      `get_ina_availability_for_period` (eine Period-Query pro Arzt)
- [x] `absent_doctor`-Constraint in `constraints.py`, eingehängt in
      `constraint_definitions`
- [x] Constraint-Tests: pos + neg + null-Doctor + Kombination mit
      `double_booked`
- [x] Mapping-Tests: Absence + Rotation + verfügbar + leerer Plan
- [x] `/solve`-Integrationstest: abwesender Arzt wird gemieden
- [x] Gesamter `pytest` (Baseline nach M8-002: 278 passed) grün
- [x] Gesamter `vitest` grün (keine Frontend-Änderung erwartet)
- [x] `ruff check` clean, `enum.StrEnum`-Konvention im neuen Code
- [x] `git diff` nur additiv (Phase-A-Invariante)
- [x] Milestone-Abschluss-Checkliste (Schritt F) vollständig

## Out of Scope

- **Apply-Pfad-Constraint-Prüfung.** Bleibt weich (ADR M8-002).
- **Regulatorisch-harte Constraints** (`max-weekly-hours`,
  `min-rest-time`) — brauchen Tarif-Werte (OQ-006), separater Milestone.
- **Soft-Constraints** (Fairness) — M8-004+.
- **Frontend-Anzeige der Constraint-Verletzungen** — Solver-Diff-UI ist
  M9-001.
- **Snapshot-Caching zwischen Solves** — Premature Optimization, eine
  Per-Doctor-Period-Query reicht für Phase-B-Startwert.
- **Re-Berechnung des Snapshots bei laufendem Solve** — nicht nötig,
  Daten sind während Solve-Dauer (30 s) stabil.
- **CK-Werktag-Sonderfall** — bereits in `get_ina_availability` enthalten,
  kein Extra-Code.

## Bekannte Stolperfallen

- **DB-Zugriff im ConstraintProvider verboten.** `lambda` darf weder
  `db` noch `session` referenzieren. Nur immutable problem facts.
- **`SolverDoctor`-Default nicht vergessen.** Bestehende Tests
  instanziieren `SolverDoctor(doctor_id, name)` ohne Snapshot — Default
  `frozenset()` muss greifen.
- **`__eq__` / `__hash__` bleiben auf `doctor_id`.** Wenn Snapshot in
  Identität einfließt, brechen Werte-Bereich-Lookups im Solver.
- **`for_each_unique_pair` vs. `for_each`.** ABSENT_DOCTOR ist ein
  Single-Entity-Constraint — `for_each(SolverShift)`, NICHT
  `for_each_unique_pair`. DOUBLE_BOOKED ist Pair-Constraint, das
  verwirrt beim Copy-Paste.
- **Leerer Plan ohne Shifts.** `min/max` auf leerer Liste wirft
  `ValueError`. Defensiv: `if orm_shifts:` prüfen.
- **`is_einarbeitung`-Rotation.** Zählt in `get_ina_availability`
  automatisch zur Nicht-Verfügbarkeit — kein Sonderfall im Mapping.
- **JVM-Guard.** Constraint-Tests brauchen JVM (timefold-Import).
  Mapping-Tests brauchen nur DB. Aufteilung in zwei Dateien hält
  `pytestmark.skipif` sauber.
- **Tarif-Werte NICHT erfinden.** ABSENT_DOCTOR ist logisch-hart, kein
  Tarif-Wert involviert. `max-weekly-hours` etc. bleiben für M8-004+.

## Annahmen

- `get_ina_availability_for_period(db, doctor_id, start, end)` bleibt in
  Signatur und Semantik unverändert (Rückgabe `dict[date,
  INAAvailability]`).
- `list_doctors(include_inactive=False)` ist die richtige Doctor-Quelle
  (gleich wie in bestehendem `to_solver`).
- Plan-Datum-Range = `min/max(shift.shift_date)`. Wenn ein Plan formal
  ein Monatsfeld hat, ignorieren wir es — Snapshot deckt nur tatsächlich
  vorhandene Shifts ab.
- Phase-B-Startwert 30 s Termination-Limit (M8-001) reicht für
  Monatspläne mit ~20 Ärzten — keine Performance-Untersuchung in diesem
  Milestone.
- Eclipse Temurin JDK 21 ist installiert
  (`C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`,
  `JAVA_HOME` gesetzt) — sonst skippen alle Constraint-Tests via
  JVM-Guard wie in M8-001.

Bei Unklarheit: `tasks/done/M8-001-solver-skeleton.md`,
`tasks/done/M8-002-solver-apply-endpoint.md` und bestehenden Code als
Referenz nutzen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M8-003-solver-absent-doctor
```

Briefing liegt in `tasks\open\M8-003-solver-absent-doctor.md`.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M8-003-solver-absent-doctor
git checkout main
git pull origin main
git merge task/M8-003-solver-absent-doctor
git push origin main
```

`pnpm generate-api` ist in diesem Milestone **nicht nötig** — keine API-
oder Schema-Änderungen (Constraint wirkt nur intern im Solver, kein
neuer Endpoint, keine neue Response-Form).

## Abschluss

**Status:** Vollständig abgeschlossen (2026-05-24). Branch
`task/M8-003-solver-absent-doctor` bereit für Merge in `main`.

**Commits (A–F):**
- A: `feat(solver): M8-003/A absent-doctor constraint id`
- B: `feat(solver): M8-003/B solver doctor availability field`
- C: `feat(solver): M8-003/C availability snapshot in mapping`
- D: `feat(solver): M8-003/D absent-doctor hard constraint + tests`
- E: `test(solver): M8-003/E solve api skips absent doctor`
- F: `docs: M8-003 abschluss + ADR-071 + CLAUDE.md`

**Testergebnis:** 370 passed (von 364 nach Sub-Schritt C + 6 neue in D/E).
Eclipse Temurin JDK 21 installiert — alle JVM-Guard-Tests laufen durch.
`ruff check` clean nach jedem Schritt.

**Availability-Snapshot-Pattern:** `SolverDoctor.unavailable_dates:
frozenset[date]` — vorberechnet in `to_solver()` via
`get_ina_availability_for_period()`. ADR-071 dokumentiert die
Design-Entscheidung (alternatives dict auf ShiftSchedule verworfen).
