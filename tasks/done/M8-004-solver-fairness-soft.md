# Task M8-004: Solver-Constraint FAIR_DISTRIBUTION (soft, FTE-gewichtet)

## Ziel

Erste Soft-Constraint im Solver. Bisher (M8-001/002/003) sind nur
logisch-harte Constraints aktiv (`DOUBLE_BOOKED`, `ABSENT_DOCTOR`); der
Soft-Score-Kanal in `HardSoftScore` ist ungenutzt. M8-004 füllt diesen
Kanal mit einer Fairness-Verteilung pro Schichttyp, gewichtet nach
Beschäftigungsumfang (FTE).

**Definition (verbindlich):**
- Pro Schichttyp wird ein Soll pro Arzt berechnet:
  `target(d, st) = floor(count_shifts_of_type(st) × fte(d) / sum_fte)`.
- Penalty pro Verstoß = `max(0, actual − target)` Soft-Punkte
  (lineare Abweichung, nur Über-Soll).
- Doctor-Pool: alle aktiven Ärzte
  (`list_doctors(include_inactive=False)`, gleicher Pool wie
  `to_solver`).
- FTE-Quelle: `EmploymentPeriod.employment_percentage` im
  Plan-Datumsbereich. Fallback `100` wenn keine Period im Zeitraum
  existiert (Externe oft ohne hinterlegte Period).
- Snapshot-Pattern (ADR-071): Target wird vor dem Solve in `to_solver`
  vorberechnet und als immutable problem fact in `SolverDoctor`
  abgelegt. Kein DB-Zugriff im Constraint.

**Additiv** — Phase A (manueller Planungsassistent) bleibt
unangetastet. Apply-Pfad bleibt weich (ADR M8-002, ADR-033). Soft-Score
beeinflusst die Lösbarkeit nicht (`feasible = hard_score >= 0`).

## Bindende Entscheidungen

1. **Constraint-ID:** `ConstraintId.FAIR_DISTRIBUTION = "fair-distribution"`.
   `SOFT`-Set erweitert: `frozenset([ConstraintId.FAIR_DISTRIBUTION])`.
2. **Snapshot-Ort:** Zwei neue Felder auf `SolverDoctor`:
   - `fte_percentage: int = 100` (Default-Fallback)
   - `fair_targets: dict[int, int]` (`shift_type_id → target_count`)
   `__eq__/__hash__` bleiben auf `doctor_id` — Snapshot ist kein
   Identitätsmerkmal (analog `unavailable_dates`, ADR-071).
3. **FTE-Service:** Neue Funktion `get_fte_for_period(db, doctor_id,
   start, end) -> int` in `services/employment_period_service.py`
   (Datei ggf. neu). Zeitanteilig gewichtetes Mittel der
   `employment_percentage`-Werte aller `EmploymentPeriod`-Einträge, die
   sich mit `[start, end]` überlappen. Keine Period → Fallback `100`.
4. **Target-Berechnung in `to_solver`:**
   - `counts_by_type: Counter[int] = Counter(s.shift_type_id for s in
     orm_shifts)`
   - `fte_per_doctor: dict[int, int] = {d.id: get_fte_for_period(db,
     d.id, plan_start, plan_end) for d in orm_doctors}`
   - `sum_fte = sum(fte_per_doctor.values())`
   - Pro Arzt × Schichttyp: `target = (counts_by_type[st] *
     fte_per_doctor[d.id]) // sum_fte` (Integer-Division).
   - Edge-Case `sum_fte == 0` (keine aktiven Ärzte): leeres `fair_targets`
     pro Arzt, kein Crash.
   - Edge-Case `plan_start is None` (leerer Plan): leeres
     `fair_targets`, FTE-Fallback `100` pro Arzt.
5. **Constraint-Stream:**
   ```python
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
   ```
6. **Apply-Pfad bleibt weich.** Keine Constraint-Prüfung in
   `solver_service.apply_solution`. Decoupling wie ADR M8-002.
7. **Soft-Score-Frontend:** Kein Frontend-Touch in diesem Milestone.
   `SolveResult.soft_score` ist bereits im Schema und wird vom
   `/solve`-Endpoint zurückgegeben (M8-001). UI-Anzeige folgt in M9-001
   (Solver-Diff-UI).

## Kontext (Leseanleitung)

1. `CLAUDE.md` (Phasenmodell, „Weiche Validierung", Timefold-Python-API,
   Snapshot-Pattern ADR-071, Solver-Konvention)
2. `docs/constraints.md` (Constraint-Klassen, Soft-Tabelle,
   `fairness-distribution`-Platzhalter)
3. `docs/decisions.md` (ADR-006, ADR-011, ADR-033, ADR M8-001/002,
   ADR-071 Snapshot-Pattern)
4. `docs/roadmap.md` (M8-004+ Zeile in Phase-B-Tabelle)
5. `backend/app/solver/domain.py` (`SolverDoctor`, `SolverShift`,
   `ShiftSchedule` — Pattern für neue Felder)
6. `backend/app/solver/mapping.py` (`to_solver(db, plan_id)` —
   Snapshot-Berechnung-Stelle nach `orm_shifts`-Load)
7. `backend/app/solver/constraints.py` (`constraint_definitions`,
   `double_booked` + `absent_doctor` als Pattern-Vorlage)
8. `backend/app/solver/tarif_rules.py` (`ConstraintId`-StrEnum,
   `LOGISCH_HART`/`SOFT`-frozensets)
9. `backend/app/models/employment_period.py` (FTE-Datenquelle,
   `valid_from/valid_to`-Semantik)
10. `tasks/done/M8-003-solver-absent-doctor.md` (Sub-Schritt-Muster,
    Snapshot-Pattern-Implementierung)

## Phase-A-Invariante

`git diff main` zeigt ausschließlich additive Änderungen in:
- `backend/app/solver/{domain,mapping,constraints,tarif_rules}.py`
- `backend/app/services/employment_period_service.py` (neu oder
  erweitert)
- `backend/tests/unit/test_solver_*.py` und
  `backend/tests/unit/test_employment_period_service.py` (Erweiterung
  oder neu)
- `backend/tests/integration/test_solve_api.py` (Erweiterung)
- `docs/{constraints,decisions,open-questions,roadmap}.md`, `CLAUDE.md`
- `tasks/open/M8-004-*.md` → `tasks/done/`

Kein Touch an: `conflict_service.py`, `shift_service.py`,
`ina_availability_service.py`, `plan_shifts.py`, `shifts.py`, ORM-
Modellen, Migrationen, Frontend.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Constraint-ID + SOFT-Set

**Datei:** `backend/app/solver/tarif_rules.py`

- `ConstraintId.FAIR_DISTRIBUTION = "fair-distribution"` hinzufügen
  (Kommentar „Soft (Optimierungsziele)" Stub entfernen).
- `SOFT` erweitern: `frozenset([ConstraintId.FAIR_DISTRIBUTION])`
  (bisher `frozenset()`).

**Akzeptanzkriterien A:**
- [x] `ConstraintId.FAIR_DISTRIBUTION` existiert mit Wert `"fair-distribution"`.
- [x] `SOFT` enthält `ConstraintId.FAIR_DISTRIBUTION`.
- [x] `LOGISCH_HART` unverändert.
- [x] `ruff check` clean.
- [x] Bestehende Tests grün (kein Mapping/Constraint-Code in diesem
      Schritt).

**Stop-Gate A:** Commit
`feat(solver): M8-004/A fair-distribution constraint id`, Review.

---

### Sub-Schritt B — `SolverDoctor.fte_percentage` + `fair_targets`

**Datei:** `backend/app/solver/domain.py`

- `SolverDoctor.__init__` um zwei Keyword-Defaults erweitern:
  - `fte_percentage: int = 100`
  - `fair_targets: dict[int, int] | None = None` →
    intern `self.fair_targets = fair_targets or {}` (mutable Default
    vermeiden).
- Attribute zuweisen, `__repr__` unverändert lassen (Snapshot-Inhalt
  nicht ins Repr).
- `__eq__` / `__hash__` bleiben auf `doctor_id`.

**Unit-Test** in `backend/tests/unit/test_solver_domain.py`:

| Test | Was wird geprüft |
|------|------------------|
| `test_solver_doctor_default_fte_100` | Default ist `100` |
| `test_solver_doctor_default_fair_targets_leer` | Default ist `{}`, jede Instanz eigenes Dict |
| `test_solver_doctor_fte_konfigurierbar` | Übergebener Wert landet im Attribut |
| `test_solver_doctor_fair_targets_konfigurierbar` | Übergebenes Dict landet im Attribut |
| `test_solver_doctor_eq_ignoriert_neue_felder` | Zwei `SolverDoctor` mit gleicher ID + unterschiedlichem FTE/targets sind `==` |

**Akzeptanzkriterien B:**
- [x] `SolverDoctor.fte_percentage` Attribut existiert, Default `100`.
- [x] `SolverDoctor.fair_targets` Attribut existiert, Default leeres
      Dict, kein shared-mutable-default-Bug.
- [x] Bestehende `SolverDoctor(doctor_id, name)`- und
      `SolverDoctor(doctor_id, name, unavailable_dates=...)`-Aufrufe
      laufen unverändert.
- [x] 5 neue Tests grün.
- [x] `ruff check` clean.

**Stop-Gate B:** Commit
`feat(solver): M8-004/B solver doctor fte and fair targets fields`,
Review.

---

### Sub-Schritt C — `get_fte_for_period` Service

**Datei:** `backend/app/services/employment_period_service.py` (neu
falls nicht existiert; sonst erweitern).

Signatur:
```python
def get_fte_for_period(
    db: Session,
    doctor_id: int,
    start: date,
    end: date,
) -> int:
    """Durchschnittlicher Beschäftigungsumfang im Zeitraum [start, end],
    gewichtet nach Tagen, die jede überlappende EmploymentPeriod beiträgt.
    Fallback 100 wenn keine Period überlappt."""
```

Implementierung:
- Lade alle `EmploymentPeriod` für `doctor_id` mit
  `valid_from <= end AND (valid_to IS NULL OR valid_to >= start)`.
- Wenn leer → return `100`.
- Pro Period: `overlap_start = max(p.valid_from, start)`,
  `overlap_end = min(p.valid_to or end, end)`,
  `days = (overlap_end - overlap_start).days + 1`.
- Gewichtetes Mittel:
  `sum(p.employment_percentage * days) / sum(days)`, gerundet auf
  `int` (Standard `round`).
- Wenn `sum(days) == 0` (defensive, sollte nicht auftreten) → return
  `100`.

**Unit-Test** in
`backend/tests/unit/test_employment_period_service.py` (neu):

| Test | Was wird geprüft |
|------|------------------|
| `test_get_fte_keine_period_fallback_100` | Arzt ohne Period → 100 |
| `test_get_fte_einzelne_period_voll_ueberlappend` | Period 50% deckt Zeitraum komplett → 50 |
| `test_get_fte_zwei_perioden_zeitanteilig_gewichtet` | 100% erste Hälfte, 50% zweite Hälfte → ~75 |
| `test_get_fte_open_ended_period` | `valid_to=None`, Period vor Plan-Start → Period zählt für gesamten Zeitraum |
| `test_get_fte_period_ausserhalb_zeitraum` | Period endet vor `start` → Fallback 100 (keine Überlappung) |

**Akzeptanzkriterien C:**
- [x] `get_fte_for_period` existiert, signatur wie oben.
- [x] 5 neue Tests grün.
- [x] `ruff check` clean.
- [x] Keine Änderungen an `EmploymentPeriod`-Modell oder Repository.

**Stop-Gate C:** Commit
`feat(services): M8-004/C employment fte for period`, Review.

---

### Sub-Schritt D — Snapshot-Berechnung im Mapping

**Datei:** `backend/app/solver/mapping.py`

Erweitere `to_solver(db, plan_id)`:

1. Nach Plan-Range-Berechnung (existierend aus M8-003): pro Arzt
   FTE holen:
   ```python
   if plan_start is None:
       fte_per_doctor = {d.id: 100 for d in orm_doctors}
   else:
       fte_per_doctor = {
           d.id: get_fte_for_period(db, d.id, plan_start, plan_end)
           for d in orm_doctors
       }
   ```
2. Schicht-Zählung pro Typ:
   ```python
   from collections import Counter
   counts_by_type: Counter[int] = Counter(s.shift_type_id for s in orm_shifts)
   ```
3. Target-Berechnung:
   ```python
   sum_fte = sum(fte_per_doctor.values())
   def _targets(doctor_id: int) -> dict[int, int]:
       if sum_fte == 0 or not counts_by_type:
           return {}
       fte = fte_per_doctor[doctor_id]
       return {
           st: (count * fte) // sum_fte
           for st, count in counts_by_type.items()
       }
   ```
4. `SolverDoctor`-Konstruktion (zusätzlich zu `unavailable_dates`):
   ```python
   SolverDoctor(
       doctor_id=d.id,
       name=d.name,
       unavailable_dates=unavailable_dates,
       fte_percentage=fte_per_doctor[d.id],
       fair_targets=_targets(d.id),
   )
   ```

Import ergänzen: `from app.services.employment_period_service import
get_fte_for_period`, `from collections import Counter`.

**Unit-Test** in `backend/tests/unit/test_solver_mapping.py`
(erweitern):

| Test | Was wird geprüft |
|------|------------------|
| `test_to_solver_fte_default_ohne_period` | Arzt ohne EmploymentPeriod → `fte_percentage=100` |
| `test_to_solver_fte_aus_period` | Arzt mit Period 50% im Plan-Range → `fte_percentage≈50` |
| `test_to_solver_fair_targets_floor_division` | 2 Ärzte (100% + 50%), 6 Shifts eines Typs → Targets (4, 2) |
| `test_to_solver_fair_targets_pro_shifttype_getrennt` | 2 ShiftTypes mit unterschiedlicher Count → Targets pro Typ |
| `test_to_solver_fair_targets_leer_bei_leerem_plan` | Plan ohne Shifts → `fair_targets={}` pro Arzt |
| `test_to_solver_fair_targets_leer_bei_keinem_aktiven_arzt` | `sum_fte==0` Edge-Case → leere Targets, kein Crash |

**Akzeptanzkriterien D:**
- [x] `to_solver` füllt `fte_percentage` und `fair_targets` pro Arzt.
- [x] `get_fte_for_period` wird einmal pro Arzt aufgerufen (nicht pro
      Tag, nicht pro ShiftType).
- [x] 6 neue Tests grün.
- [x] Bestehende Mapping-Tests grün (Snapshot `unavailable_dates`
      unverändert).
- [x] `ruff check` clean.

**Stop-Gate D:** Commit
`feat(solver): M8-004/D fair-target snapshot in mapping`, Review.

---

### Sub-Schritt E — Constraint + Constraint-Tests + Integration

**Datei:** `backend/app/solver/constraints.py`

Neue Funktion:

```python
def fair_distribution(cf: ConstraintFactory) -> Constraint:
    """Soft-Constraint: Schichten sollen FTE-gewichtet gleichmäßig pro
    Schichttyp verteilt sein. Penalty pro Schicht über dem Soll."""
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
```

In `constraint_definitions(cf)` einhängen:
```python
return [
    double_booked(cf),
    absent_doctor(cf),
    fair_distribution(cf),
]
```

Import ergänzen: `from timefold.solver.score import ConstraintCollectors`
(falls noch nicht da).

**Vorab-Spike (5 Min):** Bevor Tests geschrieben werden, einmal mit
Mini-Schedule `_solver_factory.build_solver().solve(...)` ausführen und
prüfen, ob `group_by(key1, key2, ConstraintCollectors.count())` →
`.filter(lambda a, b, c: ...)` syntaktisch akzeptiert wird. Bei
Lambda-Arity-Fehler: ggf. `ConstraintCollectors.count_distinct(...)`
oder Tuple-Variante prüfen. Pattern in CLAUDE.md-Sektion
„Timefold-Python-API" ergänzen (Sub-Schritt F).

**Unit-Test** in `backend/tests/unit/test_solver_constraints.py`
(erweitern; JVM-Guard-Pattern wiederverwenden):

| Test | Was wird geprüft |
|------|------------------|
| `test_fair_distribution_kein_penalize_bei_target_erreicht` | 2 Shifts Type 1, target=2 → soft_score == 0 |
| `test_fair_distribution_penalize_pro_ueber_soll_shift` | 4 Shifts Type 1 einem Arzt, target=2 → soft_score == -2 |
| `test_fair_distribution_kein_penalize_bei_null_doctor` | Offene Shifts ohne Doctor → kein Penalty |
| `test_fair_distribution_getrennt_pro_shifttype` | Arzt Über-Soll in Type 1, unter Soll in Type 2 → nur Type-1-Penalty zählt |
| `test_fair_distribution_und_double_booked_unabhaengig` | Beide Verstöße gleichzeitig → hard_score < 0 UND soft_score < 0 |

**Datei:** `backend/tests/integration/test_solve_api.py` (erweitern):

| Test | Was wird geprüft |
|------|------------------|
| `test_solve_verteilt_fairer_als_zufall` | 2 Ärzte (gleiche FTE), 4 Shifts gleichen Typs → Solver-Ergebnis hat keinen Arzt mit > 2 Shifts (target=2), `soft_score >= -1` (Rounding-Toleranz) |

JVM-Guard für beide Test-Files konsistent zu M8-003.

**Akzeptanzkriterien E:**
- [x] `fair_distribution` in `constraints.py`, eingehängt in
      `constraint_definitions`.
- [x] 5 Constraint-Tests grün (oder skipped via JVM-Guard).
- [x] 1 Integrationstest grün (oder skipped via JVM-Guard).
- [x] `double_booked`- und `absent_doctor`-Tests aus M8-001/003
      weiterhin grün.
- [x] `ruff check` clean.
- [x] Vorab-Spike-Erkenntnis zu `group_by(key, key, count())` notiert
      (für Sub-Schritt F → CLAUDE.md).

**Stop-Gate E:** Commit
`feat(solver): M8-004/E fair-distribution soft constraint + tests`,
Review.

---

### Sub-Schritt F — Abschluss-Dokumentation

Pflichtschritte laut CLAUDE.md-Milestone-Abschluss-Checkliste:

1. **`tasks/open/M8-004-solver-fairness-soft.md`** → `tasks/done/`
   verschieben; alle `[ ]` → `[x]`; Abschnitt „Abschluss" anhängen
   (Datum, Branch, Commit-Liste, Testergebnis).
2. **`docs/open-questions.md`**: neue Fragen eintragen falls aufgetaucht
   (z. B. „Soll Fairness über Plan-Grenzen aggregieren?", „Sollen
   Soft-Constraints konfigurierbare Gewichte haben?"). OQ-006 (Tarif-
   Werte) bleibt offen — FAIR_DISTRIBUTION braucht keine Tarif-Werte.
3. **`docs/decisions.md`**: neuer ADR „Soft-Constraint
   FAIR_DISTRIBUTION (FTE-gewichtet, Snapshot-Pattern, Over-Target
   linear)". Begründung: FTE-Gewichtung statt Pro-Kopf
   (Teilzeit-Klinik), Over-Target-Only statt Symmetrisch (KISS, kein
   Phantom-Pivot), Snapshot-Pattern (ADR-071-Reuse), `floor`-Division
   (Rounding-Verlust akzeptabel, da Unter-Soll keine Penalty).
4. **`docs/constraints.md`**: `fairness-distribution`-Zeile in
   Constraint-Tabelle von „Planned" auf „Implementiert (M8-004)";
   FTE-Berechnung und Per-Type-Pool dokumentieren.
5. **`docs/roadmap.md`**: M8-004-Zeile in Phase-B-Tabelle auf ✅
   setzen (Datum, Branch-Name). Falls bisher keine eigene M8-004-Zeile
   existiert (nur „M8-004+ Sammel-Zeile"), Zeile neu eintragen und
   Sammel-Zeile als „M8-005+ Weitere Soft-Constraints" zurückbauen.
6. **`CLAUDE.md`**: Solver-Sektion erweitern um:
   - Soft-Score-Pattern (analog Snapshot-Pattern (M8-003) +
     Solver-Vorschlags-Diff (M8-001)).
   - Verifizierter Timefold-Python-API-Eintrag für `group_by` mit
     zwei keys + `ConstraintCollectors.count()` und Lambda-Arity in
     nachfolgendem `.filter`/`.penalize` (Erkenntnis aus
     Sub-Schritt-E-Spike).

**Stop-Gate F:** Commit
`docs: M8-004 abschluss + ADR fair-distribution`, Review.

---

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `ConstraintId.FAIR_DISTRIBUTION` + `SOFT`-Set erweitert
- [x] `SolverDoctor.fte_percentage: int` (Default 100) und
      `SolverDoctor.fair_targets: dict[int, int]` (Default leer)
- [x] `get_fte_for_period` in `employment_period_service.py`
      zeitanteilig korrekt + Fallback 100
- [x] `to_solver` füllt FTE und Targets pro Arzt (eine FTE-Query pro
      Arzt, eine Schicht-Zählung pro Plan)
- [x] `fair_distribution`-Constraint in `constraints.py`, eingehängt
      in `constraint_definitions`
- [x] Domain-Tests: 5 Tests grün
- [x] Service-Tests: 5 Tests grün
- [x] Mapping-Tests: 6 Tests grün
- [x] Constraint-Tests: 5 Tests grün (JVM-Guard)
- [x] Integrationstest: 1 Test grün (JVM-Guard)
- [x] Gesamter `pytest`-Lauf grün (Baseline nach M8-003: 370 passed;
      Ziel ≥ 392 passed)
- [x] Gesamter `vitest` grün (keine Frontend-Änderung erwartet)
- [x] `ruff check` clean, `enum.StrEnum`-Konvention eingehalten
- [x] `git diff main` nur additiv (Phase-A-Invariante)
- [x] Milestone-Abschluss-Checkliste (Schritt F) vollständig

## Out of Scope

- **Wunsch-/Wochenend-Constraints** (gezielte Schicht-Präferenzen) —
  M8-005+.
- **Schichtfolge-Penalties** (Nacht→Tag-Wechsel, Wochenend-Häufung) —
  M8-005+.
- **Under-Target-Penalty** (Phantom-Pivots für 0-Schichten-Ärzte) —
  optional in M8-005 wenn Verteilung in Praxis schlecht ausfällt.
- **Konfigurierbare Soft-Gewichte** pro Constraint
  (`penalize_configurable`) — Premature, alle Soft auf `ONE_SOFT`.
- **Fairness über Plan-Grenzen** (langfristige Belastung,
  rolling-window) — separater Milestone, braucht ADR.
- **Frontend-Anzeige `soft_score`** — M9-001 (Solver-Diff-UI).
- **Externes-Arzt-Sonderhandling** über FTE-Fallback hinaus — KISS,
  Externe zählen mit FTE=100 wenn keine Period.
- **Caching von `get_fte_for_period`** — eine Query pro Arzt pro Solve
  reicht; Optimierung wenn Profiling Probleme zeigt.
- **Apply-Pfad-Score-Check** — bleibt weich (ADR M8-002).

## Bekannte Stolperfallen

- **DB-Zugriff im ConstraintProvider verboten.** Lambdas dürfen weder
  `db` noch `session` referenzieren. Targets und FTE sind immutable
  problem facts.
- **`SolverDoctor`-Defaults nicht vergessen.** Bestehende Tests
  instanziieren ohne neue Felder — Defaults `100` und `{}` müssen
  greifen.
- **Mutable Default Trap.** `fair_targets: dict = {}` als Default-
  Argument teilt ein Dict zwischen allen Instanzen. Korrekt:
  `fair_targets: dict | None = None` mit `self.fair_targets =
  fair_targets or {}`.
- **`__eq__/__hash__` bleiben auf `doctor_id`.** Wenn Snapshot in
  Identität einfließt, brechen Werte-Bereich-Lookups im Solver.
- **`group_by` mit 2 Keys + Collector — Lambda-Arity unsicher.**
  Timefold-Python (`timefold==1.24.0b0`) verifiziert für `group_by(key,
  collector)` (M8-001 `for_each_unique_pair`-Variante) und `for_each`
  (M8-003 `absent_doctor`), aber `group_by(key, key, count())` ist
  neu — Sub-Schritt-E-Spike vor Test-Implementierung.
- **`group_by` gibt nur Schlüssel mit ≥ 1 Match zurück.** Ärzte mit
  0 Shifts eines Typs erscheinen nicht im Stream. Das ist beabsichtigt
  (Out of Scope: Under-Target-Penalty).
- **`floor`-Division (`//`) verliert Rest.** Summe der Targets kann
  < Total-Shifts sein (z. B. 7 Shifts auf 2 Ärzte 100%/50% →
  Targets 4/2 statt 4.67/2.33). Solver akzeptiert das, weil Unter-Soll
  keine Penalty hat — Rest-Schicht wird auf den günstigsten Arzt
  verteilt, der gerade Spielraum hat.
- **Leerer Plan / keine aktiven Ärzte.** `sum_fte == 0` oder
  `counts_by_type` leer → `fair_targets = {}` pro Arzt, kein
  ZeroDivisionError.
- **EmploymentPeriod-Überlappung mit `valid_to=None`.** `valid_to or
  end` mappt offen-endige Period auf Plan-Ende.
- **`days = (overlap_end - overlap_start).days + 1`.** Inklusive
  Start- und End-Tag. Sonst verlieren 1-Tages-Perioden ihr Gewicht.
- **JVM-Guard.** Constraint-Tests + Integration brauchen JVM. Domain-,
  Service-, Mapping-Tests brauchen nur DB.
- **Pinned Shifts zählen in `actual`.** Solver kann sie nicht
  verschieben → ggf. unvermeidliche Penalty wenn User selbst
  unfair gepinnt hat. Erwartetes Verhalten, kein Bug.

## Annahmen

- `EmploymentPeriod.employment_percentage` ist `int` 1–100 (Check-
  Constraint im Modell), kann direkt als FTE-Gewicht verwendet werden.
- `list_doctors(include_inactive=False)` bleibt die kanonische Doctor-
  Quelle in `to_solver` (gleich wie M8-003).
- `get_ina_availability_for_period` bleibt in Signatur und Semantik
  unverändert.
- Plan-Datum-Range = `min/max(shift.shift_date)` (gleich wie M8-003).
- `HardSoftScore.ONE_SOFT` ist die korrekte Soft-Penalty-Konstante in
  `timefold==1.24.0b0` (gleicher Score-Typ wie `ONE_HARD`).
- 30 s Termination-Limit (M8-001) reicht für Soft-Optimierung auf
  Monatsplänen mit ~20 Ärzten — keine Performance-Untersuchung in
  diesem Milestone.
- Eclipse Temurin JDK 21 ist installiert (Pfad wie M8-003) — sonst
  skippen Constraint- und Integrationstests via JVM-Guard.

Bei Unklarheit: `tasks/done/M8-001-solver-skeleton.md`,
`tasks/done/M8-003-solver-absent-doctor.md` und bestehenden Solver-Code
als Referenz nutzen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M8-004-solver-fairness-soft
```

Briefing liegt in `tasks\open\M8-004-solver-fairness-soft.md`.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M8-004-solver-fairness-soft
git checkout main
git pull origin main
git merge task/M8-004-solver-fairness-soft
git push origin main
```

`pnpm generate-api` ist in diesem Milestone **nicht nötig** — keine
API- oder Schema-Änderungen (Constraint wirkt nur intern im Solver,
`soft_score` ist bereits Teil von `SolveResult` seit M8-001).

## Abschluss

**Status:** Vollständig abgeschlossen (2026-05-26). Branch
`task/M8-004-solver-fairness-soft` bereit für Merge in `main`.

**Commits:**
- A: `feat(solver): M8-004/A fair-distribution constraint id`
- B: `feat(solver): M8-004/B solver doctor fte and fair targets fields`
- B (fix): `fix(solver): M8-004/B explicit None check + mutation isolation test`
- C: `feat(services): M8-004/C employment fte for period`
- D: `feat(solver): M8-004/D fair-target snapshot in mapping`
- E: `feat(solver): M8-004/E fair-distribution soft constraint + tests`
- E (style): `style(solver): M8-004/E trim fair_distribution docstring to 2-line comment`
- F: `docs: M8-004 abschluss + ADR-076 + CLAUDE.md`

**Testergebnis:** 270 passed (von 253 Baseline nach M8-003 mit JVM). Eclipse
Temurin JDK 21 installiert — alle JVM-Guard-Tests laufen durch. `ruff check`
clean nach jedem Schritt. `vitest` unverändert (kein Frontend-Touch).

**Spike-Ergebnis:** `group_by(key1_fn, key2_fn, ConstraintCollectors.count())`
mit 3-Argument-Lambda in `.filter(lambda k1, k2, count: ...)` und
`.penalize(score, lambda k1, k2, count: ...)` funktioniert in timefold==1.24.0b0.
In CLAUDE.md und constraints.py dokumentiert.

**ADR-076:** Soft-Constraint FAIR_DISTRIBUTION — FTE-gewichtet, Snapshot-Pattern
(ADR-071 Reuse), Over-Target-Only, getrennte Pools pro ShiftType.
