# Task M8-005: Solver-Constraint MAX_BD_PER_MONTH (regulatorisch-hart)

## Ziel

Erste regulatorisch-harte Solver-Constraint: Max. 4 Bereitschaftsdienste pro
Arzt pro Kalendermonat gemäß § 7 Abs. 5a TV-Ärzte/TdL i.d.F. 9. ÄnderungsTV.

Bisher (M8-001–004) prüft der Solver nur logisch-harte Constraints (DOUBLE_BOOKED,
ABSENT_DOCTOR) und eine Soft-Constraint (FAIR_DISTRIBUTION). M8-005 füllt
`REGULATORISCH_HART`-Kanal mit dem BD-Limit und liefert damit erstmals eine
echte Tarif-Prüfung im Solver-Diff.

**Additiv** — Phase A (manueller Planungsassistent) bleibt unangetastet. Keine
Schreibpfad-Blockade. Override-Mechanismus A/B/C (Phase B) ist Out of Scope;
der Constraint-Code ist so strukturiert, dass er später per Override-Pattern
abschaltbar ist.

## Bindende Entscheidungen

1. **Tarif-Schwelle:** `MAX_BD_PER_MONAT = 4` (§ 7 Abs. 5a Satz 1).
   Ausnahmen (5/Monat pro Quartal per Satz 2, 7/Monat per Individualvereinbarung
   per Satz 4) sind Phase-B-Override-Fälle — nicht in diesem Milestone.
   Wert als Konstante in `backend/app/solver/tarif_rules.py` (OQ-006: Option A).

2. **BD-Klassifizierung via ShiftType-Flag:** Neues Feld
   `ShiftType.is_bereitschaftsdienst: bool` (Default `False`).
   Klinik kann pro Schichttyp konfigurieren, welche als BD zählen.
   Alternative (app_settings-ID-Liste) abgelehnt — ShiftType-Flag ist
   explizit, sichtbar im Admin und direkt mit dem Entitäts-Begriff verbunden.

3. **Constraint-ID:** `ConstraintId.MAX_BD_PER_MONTH = "max-bd-per-month"`.
   `REGULATORISCH_HART`-Set erweitern: `frozenset([ConstraintId.MAX_BD_PER_MONTH])`.
   `LOGISCH_HART` und `SOFT` unverändert.

4. **Snapshot-Feld auf SolverShift:** `is_bereitschaftsdienst: bool = False`.
   Wird in `to_solver()` aus dem ORM-ShiftType gelesen. Kein DB-Zugriff im
   Constraint (Snapshot-Pattern ADR-071).

5. **Constraint-Score:** `HardSoftScore.ONE_HARD` — regulatorisch-hart hat
   gleiche Score-Klasse wie logisch-hart. Unterschied liegt nur in der
   Override-Semantik (LOGISCH_HART nie overridebar, REGULATORISCH_HART per
   Override-Mechanismus A/B/C abschaltbar — Mechanismus kommt später).

6. **Constraint-Stream:**
   ```python
   def max_bd_per_month(cf: ConstraintFactory) -> Constraint:
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
   ```
   Pattern `group_by(key1, key2, count())` + 3-Arg-Lambda: verifiziert in
   timefold==1.24.0b0 (M8-004 Sub-Schritt E Spike).

7. **`pnpm generate-api` nötig** (ShiftType-Schema ändert sich) — in Sub-Schritt A.

## Kontext (Leseanleitung)

1. `CLAUDE.md` (Phasenmodell, „Weiche Validierung", Snapshot-Pattern,
   Timefold-Python-API, OQ-006-Entscheidung)
2. `docs/constraints.md` (Folge-Milestones-Tabelle: `max-weekly-hours`,
   `min-rest-time` — werden in M8-006+ implementiert)
3. `docs/decisions.md` (ADR-071 Snapshot-Pattern, ADR-076 Soft-Pattern)
4. `docs/roadmap.md` (M8-005+ Zeile in Phase-B-Tabelle)
5. `docs/open-questions.md` (OQ-006 entschieden 2026-05-29: Option A hardcoded)
6. `backend/app/models/shift_type.py` (ShiftType ORM, Ergänzungsort für neues Feld)
7. `backend/app/schemas/shift_type.py` (Pydantic-Schemas: Base/Create/Update/Read)
8. `backend/app/solver/domain.py` (`SolverShift`, `SolverDoctor` — Snapshot-Felder-Pattern)
9. `backend/app/solver/mapping.py` (`to_solver` — Snapshot-Berechnung-Stelle)
10. `backend/app/solver/constraints.py` (`double_booked`, `absent_doctor`,
    `fair_distribution` als Pattern-Vorlage; `constraint_definitions` Einhängepunkt)
11. `backend/app/solver/tarif_rules.py` (`ConstraintId`, `REGULATORISCH_HART`-Stub)
12. `tasks/done/M8-004-solver-fairness-soft.md` (Sub-Schritt-Muster, Spike-Erfahrung
    zu `group_by(key1, key2, count())`)
13. `tasks/done/M8-003-solver-absent-doctor.md` (Snapshot-Pattern-Referenz)

## Phase-A-Invariante

`git diff main` zeigt ausschließlich additive oder eng gescoped Änderungen in:
- `backend/app/models/shift_type.py` (neues Feld)
- `backend/alembic/versions/<hash>_add_is_bereitschaftsdienst.py` (Migration)
- `backend/app/schemas/shift_type.py` (neues optionales Feld)
- `backend/app/solver/{domain,mapping,constraints,tarif_rules}.py`
- `backend/tests/unit/test_solver_{domain,mapping,constraints}.py`
- `backend/tests/integration/test_solve_api.py`
- `frontend/src/lib/api.ts` (generiert — `pnpm generate-api`)
- `docs/{constraints,decisions,open-questions,roadmap}.md`, `CLAUDE.md`
- `tasks/open/M8-005-*.md` → `tasks/done/`

Kein Touch an: `conflict_service.py`, `shift_service.py`,
`ina_availability_service.py`, Plan-API, Rotations-/Absence-APIs, ORM-Modelle
außer ShiftType, bestehende Migrationen, Frontend-Komponenten.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

---

### Sub-Schritt A — ShiftType-Modell + Migration + Schema + API-Typen

**Ziel:** `is_bereitschaftsdienst`-Feld persistieren und nach außen exponieren.

**Datei:** `backend/app/models/shift_type.py`
- `is_bereitschaftsdienst: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)`
  (nach `active`-Feld einfügen).

**Alembic-Migration:**
```bash
cd backend
uv run alembic revision --autogenerate -m "add_is_bereitschaftsdienst_to_shift_types"
```
Migration prüfen: `op.add_column("shift_types", sa.Column("is_bereitschaftsdienst", sa.Boolean(), nullable=False, server_default=sa.text("0")))` (SQLite: `0` = False).
Bestehende Zeilen erhalten Default `False`.

**Datei:** `backend/app/schemas/shift_type.py`
- In `ShiftTypeBase` (oder `ShiftTypeCreate`/`ShiftTypeUpdate` je nach Schema-Struktur):
  `is_bereitschaftsdienst: bool = False`
- In `ShiftTypeRead`:
  `is_bereitschaftsdienst: bool`
  (Pflichtfeld im Read-Schema, da immer vorhanden)

**API-Typen regenerieren (im Frontend-Verzeichnis):**
```powershell
cd frontend
pnpm generate-api
```
Prüfen: `frontend/src/lib/api.ts` enthält `is_bereitschaftsdienst` in ShiftType-Typ.

**Akzeptanzkriterien A:**
- [x] `ShiftType.is_bereitschaftsdienst` im ORM-Modell vorhanden, Default `False`.
- [x] Migration angewandt (`uv run alembic upgrade head`), SQLite-DB-Datei aktuell.
- [x] `ShiftTypeRead.is_bereitschaftsdienst` im Pydantic-Schema.
- [x] `pnpm generate-api` fehlerfrei, `api.ts` aktuell.
- [x] Bestehende Backend-Tests grün (kein Schema-Bruch).
- [x] `ruff check` clean.

**Stop-Gate A:** Commit `feat(models): M8-005/A shift_type is_bereitschaftsdienst field + migration`, Review.

---

### Sub-Schritt B — ConstraintId + Tarif-Konstante + REGULATORISCH_HART

**Datei:** `backend/app/solver/tarif_rules.py`

Ergänzungen:
```python
class ConstraintId(enum.StrEnum):
    # --- Logisch-hart (nie overridebar) ---
    DOUBLE_BOOKED = "double-booked"
    ABSENT_DOCTOR = "absent-doctor"

    # --- Regulatorisch-hart (overridebar A/B/C) ---
    MAX_BD_PER_MONTH = "max-bd-per-month"

    # --- Soft (Optimierungsziele) ---
    FAIR_DISTRIBUTION = "fair-distribution"
```

Tarif-Konstante (unter den ConstraintId-Sets einfügen):
```python
# Tarif-Werte TV-Ärzte/TdL i.d.F. 9. ÄnderungsTV (OQ-006, Option A hardcoded)
MAX_BD_PER_MONAT: int = 4  # § 7 Abs. 5a Satz 1
```

`REGULATORISCH_HART` erweitern:
```python
REGULATORISCH_HART: frozenset[ConstraintId] = frozenset([ConstraintId.MAX_BD_PER_MONTH])
```

**Akzeptanzkriterien B:**
- [x] `ConstraintId.MAX_BD_PER_MONTH` mit Wert `"max-bd-per-month"`.
- [x] `MAX_BD_PER_MONAT = 4` als Modulkonstante.
- [x] `REGULATORISCH_HART` enthält `MAX_BD_PER_MONTH`.
- [x] `LOGISCH_HART` und `SOFT` unverändert.
- [x] `ruff check` clean. Bestehende Tests grün.

**Stop-Gate B:** Commit `feat(solver): M8-005/B max-bd-per-month constraint id + tarif constant`, Review.

---

### Sub-Schritt C — SolverShift.is_bereitschaftsdienst Snapshot-Feld

**Datei:** `backend/app/solver/domain.py`

`SolverShift.__init__` um `is_bereitschaftsdienst: bool = False` erweitern:
```python
def __init__(
    self,
    shift_id: int,
    plan_id: int,
    shift_date: date,
    shift_type_id: int,
    doctor: SolverDoctor | None = None,
    *,
    is_pinned: bool = False,
    is_bereitschaftsdienst: bool = False,  # neu
) -> None:
    ...
    self.is_bereitschaftsdienst = is_bereitschaftsdienst
```

Auch als Klassen-Annotation ergänzen:
```python
# Nicht-variable Felder (problem facts dieser Entity)
plan_id: int
shift_date: date
shift_type_id: int
is_bereitschaftsdienst: bool  # neu
```

`__repr__` unverändert lassen.

**Unit-Tests** in `backend/tests/unit/test_solver_domain.py` (erweitern):

| Test | Was wird geprüft |
|------|------------------|
| `test_solver_shift_default_is_bd_false` | Default `is_bereitschaftsdienst=False` |
| `test_solver_shift_is_bd_konfigurierbar` | `is_bereitschaftsdienst=True` landet im Attribut |
| `test_solver_shift_bestehende_konstruktoren_unveraendert` | `SolverShift(id, plan, date, type_id)` ohne neues Kwarg → kein Fehler |

**Akzeptanzkriterien C:**
- [x] `SolverShift.is_bereitschaftsdienst` Attribut vorhanden, Default `False`.
- [x] Bestehende `SolverShift(...)`-Aufrufe ohne neues Kwarg laufen unverändert.
- [x] 3 neue Tests grün. `ruff check` clean.

**Stop-Gate C:** Commit `feat(solver): M8-005/C solver shift is_bereitschaftsdienst snapshot field`, Review.

---

### Sub-Schritt D — Snapshot-Propagation in to_solver()

**Datei:** `backend/app/solver/mapping.py`

In `to_solver(db, plan_id)` nach dem ShiftType-Lookup (bzw. bei `SolverShift`-Konstruktion):

1. ShiftType-Map aufbauen (einmalig vor der Shift-Schleife):
   ```python
   from app.models.shift_type import ShiftType as ShiftTypeORM
   shift_type_map: dict[int, bool] = {
       st.id: st.is_bereitschaftsdienst
       for st in db.query(ShiftTypeORM).filter(ShiftTypeORM.active == True).all()
   }
   ```
   Falls bereits ein ShiftType-Lookup existiert: diesen erweitern statt neu anlegen.

2. Bei `SolverShift`-Konstruktion:
   ```python
   SolverShift(
       shift_id=s.id,
       plan_id=s.plan_id,
       shift_date=s.shift_date,
       shift_type_id=s.shift_type_id,
       doctor=...,
       is_pinned=s.is_pinned,
       is_bereitschaftsdienst=shift_type_map.get(s.shift_type_id, False),  # neu
   )
   ```

**Unit-Tests** in `backend/tests/unit/test_solver_mapping.py` (erweitern):

| Test | Was wird geprüft |
|------|------------------|
| `test_to_solver_shift_is_bd_propagiert` | ShiftType mit `is_bereitschaftsdienst=True` → `SolverShift.is_bereitschaftsdienst=True` |
| `test_to_solver_shift_is_bd_false_default` | ShiftType ohne Flag → `SolverShift.is_bereitschaftsdienst=False` |
| `test_to_solver_shift_type_nicht_in_map_fallback_false` | Unbekannte `shift_type_id` → False, kein KeyError |

**Akzeptanzkriterien D:**
- [x] `to_solver` propagiert `is_bereitschaftsdienst` von ShiftType auf SolverShift.
- [x] ShiftType-Map wird einmal pro `to_solver`-Aufruf aufgebaut (nicht pro Shift).
- [x] 3 neue Tests grün. Bestehende Mapping-Tests grün. `ruff check` clean.

**Stop-Gate D:** Commit `feat(solver): M8-005/D bd snapshot propagation in mapping`, Review.

---

### Sub-Schritt E — Constraint + Tests + Integration

**Datei:** `backend/app/solver/constraints.py`

Import ergänzen:
```python
from app.solver.tarif_rules import ConstraintId, MAX_BD_PER_MONAT
```
(Falls `MAX_BD_PER_MONAT` noch nicht importiert — ggf. bestehenden Import erweitern.)

Neue Funktion:
```python
def max_bd_per_month(cf: ConstraintFactory) -> Constraint:
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
```

In `constraint_definitions(cf)` einhängen:
```python
return [
    double_booked(cf),
    absent_doctor(cf),
    max_bd_per_month(cf),
    fair_distribution(cf),
]
```

**Unit-Tests** in `backend/tests/unit/test_solver_constraints.py` (erweitern;
JVM-Guard-Pattern wie M8-003/004):

| Test | Was wird geprüft |
|------|------------------|
| `test_max_bd_kein_penalize_bei_4_oder_weniger` | 4 BD-Shifts einem Arzt → `hard_score == 0` |
| `test_max_bd_penalize_bei_5_bd` | 5 BD-Shifts einem Arzt → `hard_score == -1` |
| `test_max_bd_penalize_skaliert_linear` | 6 BD-Shifts → `hard_score == -2` |
| `test_max_bd_kein_penalize_nicht_bd_shifts` | 5 Shifts ohne BD-Flag → `hard_score == 0` |
| `test_max_bd_kein_penalize_offene_shifts` | 5 BD-Shifts ohne Doctor → `hard_score == 0` |
| `test_max_bd_getrennt_pro_arzt` | Arzt A: 5 BD, Arzt B: 3 BD → nur Arzt A penalisiert |

**Integrations-Test** in `backend/tests/integration/test_solve_api.py` (erweitern):

| Test | Was wird geprüft |
|------|------------------|
| `test_solve_respektiert_bd_limit` | 2 Ärzte, 6 BD-Shifts eines Typs → Solver verteilt auf ≤ 4 pro Arzt, `hard_score == 0` (wenn genug Ärzte und Schichten verteilt werden können) |

JVM-Guard konsistent zu M8-003/004.

**Akzeptanzkriterien E:**
- [x] `max_bd_per_month` in `constraints.py`, eingehängt in `constraint_definitions`.
- [x] 6 Unit-Tests grün (oder JVM-Guard skipped).
- [x] 1 Integrationstest grün (oder JVM-Guard skipped).
- [x] `double_booked`-, `absent_doctor`-, `fair_distribution`-Tests weiterhin grün.
- [x] `ruff check` clean.

**Stop-Gate E:** Commit `feat(solver): M8-005/E max-bd-per-month hard constraint + tests`, Review.

---

### Sub-Schritt F — Abschluss-Dokumentation

Pflichtschritte laut CLAUDE.md-Milestone-Abschluss-Checkliste:

1. **`tasks/open/M8-005-solver-bd-limit.md`** → `tasks/done/` verschieben;
   alle `[ ]` → `[x]`; Abschnitt „Abschluss" anhängen (Datum, Branch, Commits,
   Testergebnis).
2. **`docs/open-questions.md`**: neue Fragen falls aufgetaucht (z. B. „Wer
   konfiguriert `is_bereitschaftsdienst` im Frontend — braucht ShiftType-Edit-UI
   ein neues Feld?").
3. **`docs/decisions.md`**: neuer ADR „MAX_BD_PER_MONTH (regulatorisch-hart,
   ShiftType-Flag, hardcoded Schwelle 4)". Begründung: ShiftType-Flag statt
   app_settings (explizit, OQ-006 Option A); Schwelle 4 = § 7 Abs. 5a Satz 1
   Standard; Ausnahmen (5/Quartal, 7/Vereinbarung) = Override-Fälle (Phase B).
4. **`docs/constraints.md`**: `max-bd-per-month`-Zeile in Folge-Milestones-Tabelle
   auf „Implementiert (M8-005)" setzen. Implementierungsdetails (Constraint-Stream,
   Snapshot-Feld, Tarif-Schwelle, Ausnahme-Override) dokumentieren.
5. **`docs/roadmap.md`**: M8-005-Zeile in Phase-B-Tabelle auf ✅ setzen.
6. **`CLAUDE.md`**: Tarif-Werte-Sektion ergänzen:
   - `MAX_BD_PER_MONAT = 4` (§ 7 Abs. 5a TV-Ärzte/TdL, hardcoded in `tarif_rules.py`).
   - `ShiftType.is_bereitschaftsdienst` als Klassifizierungsfeld dokumentieren.

**Stop-Gate F:** Commit `docs: M8-005 abschluss + ADR max-bd-per-month`, Review.

---

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `ShiftType.is_bereitschaftsdienst: bool` im ORM, Default `False`
- [x] Alembic-Migration angewandt, keine bestehenden Daten beschädigt
- [x] `ShiftTypeRead.is_bereitschaftsdienst` in Pydantic-Schema + `api.ts` aktuell
- [x] `ConstraintId.MAX_BD_PER_MONTH` + `MAX_BD_PER_MONAT = 4` in `tarif_rules.py`
- [x] `REGULATORISCH_HART` enthält `MAX_BD_PER_MONTH`
- [x] `SolverShift.is_bereitschaftsdienst: bool` (Default `False`) im Solver-Domain
- [x] `to_solver()` propagiert `is_bereitschaftsdienst` von ShiftType einmal pro Aufruf
- [x] `max_bd_per_month`-Constraint in `constraints.py`, eingehängt
- [x] Domain-Tests: 3 Tests grün
- [x] Mapping-Tests: 3 Tests grün
- [x] Constraint-Tests: 6 Tests grün (JVM-Guard)
- [x] Integrationstest: 1 Test grün (JVM-Guard)
- [x] Alle bestehenden Tests weiterhin grün
- [x] `ruff check` clean, `enum.StrEnum`-Konvention eingehalten
- [x] `git diff main` nur im deklarierten Scope (Phase-A-Invariante)
- [x] Milestone-Abschluss-Checkliste (Schritt F) vollständig

## Out of Scope

- **MAX_WEEKENDS_PER_MONTH** (§ 6 Abs. 9): Wochenend-Limit — M8-006.
  Benötigt `ConstraintCollectors.to_set()` (in timefold==1.24.0b0 unverif.) und
  komplexeres Weekend-Key-Mapping (Fr/Sa/So → gleiche Wochenend-Einheit).
- **MAX_WEEKLY_HOURS** (§ 7 Abs. 5 + ArbZG § 3): Wochenstunden-Limit — M8-007.
  Benötigt Schichtdauer-Snapshot (start_time, end_time in Minuten) auf SolverShift.
- **MIN_REST_TIME**: Mindestruhezeit zwischen Diensten — M8-008+.
  Benötigt paarweisen Vergleich konsekutiver Shifts (for_each_unique_pair-Pattern).
- **Frontend-Anzeige `hard_score`-Verschlechterung** durch BD-Limit — M9-001.
- **Override-Mechanismus A/B/C** (5/Quartal-Ausnahme, 7/Monat-Vereinbarung) — Phase B.
- **ShiftType-Edit-UI** für `is_bereitschaftsdienst`-Flag im Frontend: Backend-Feld
  und API sind nach Sub-Schritt A vollständig. Frontend-Formular-Update ist
  separater UI-Milestone (Scope-Grenze: Solver-Constraints ≠ UI-Polish).
- **`is_bereitschaftsdienst` in Tarif-Warnings-Pipeline** (M5-001 Phase-A-Modul) —
  die Phase-A-Pipeline ist read-only und constraint-unabhängig; kein Touch.

## Bekannte Stolperfallen

- **DB-Zugriff im Constraint verboten.** `is_bereitschaftsdienst` muss im Snapshot
  liegen — nicht per `shift_type_id`-Lookup in der Lambda.
- **`shift_date.month` ohne Jahr** gruppiert theoretisch Jahresübergänge falsch.
  Pläne sind monatlich, daher kein Problem. Für Multi-Monats-Pläne wäre
  `(shift_date.year, shift_date.month)` als Tuple-Key nötig — Out of Scope.
- **ShiftType-Map in `to_solver()`:** Nur aktive ShiftTypes abfragen (`active == True`).
  Inaktive ShiftTypes können im Plan-Kontext nicht auftreten, aber defensiv `.get(id, False)`
  statt `[id]` verwenden.
- **Migration SQLite:** `server_default=sa.text("0")` statt `server_default="false"` —
  SQLite kennt kein `TRUE`/`FALSE`, nur `1`/`0`.
- **`pnpm generate-api` muss laufen bevor Frontend-Tests geprüft werden** — sonst
  TypeScript-Typfehler in vitest.
- **Pinned Shifts zählen.** BD-Shifts die gepinnt sind, werden vom Solver nicht
  verschoben. Wenn User 5 BD-Shifts gepinnt hat, entsteht unvermeidliche Hard-Penalty.
  Erwartetes Verhalten — kein Bug, kein Override in diesem Milestone.
- **`group_by(key1, key2, count())` Lambda-Arity:** Gilt als verifiziert aus M8-004.
  Falls trotzdem Lambda-Arity-Fehler: Tuple-Key `(doctor, month)` als Fallback.
- **`ConstraintCollectors`-Import:** Bereits in `constraints.py` nach M8-004 — prüfen
  bevor erneut importiert wird.

## Annahmen

- `ShiftType.is_bereitschaftsdienst` wird initial `False` für alle bestehenden
  Typen; Klinik konfiguriert die richtigen Typen manuell (oder per direktem
  DB-Update während Rollout).
- `group_by(key1_fn, key2_fn, ConstraintCollectors.count())` + 3-Arg-Lambda in
  `.filter`/`.penalize` funktioniert in timefold==1.24.0b0 (M8-004-Spike bestätigt).
- Eclipse Temurin JDK 21 ist installiert (Pfad wie M8-003/004) — sonst skippen
  Constraint- und Integrationstests via JVM-Guard.
- `HardSoftScore.ONE_HARD` ist korrekt für regulatorisch-harte Constraints
  (gleicher Score-Kanal wie logisch-hart, semantischer Unterschied nur im
  Override-Mechanismus der späteren Phase B).
- 30 s Termination-Limit (M8-001) reicht auch mit dem dritten Constraint.

Bei Unklarheit: `tasks/done/M8-004-solver-fairness-soft.md`,
`tasks/done/M8-003-solver-absent-doctor.md` und bestehenden Solver-Code
als Referenz nutzen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:
```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M8-005-solver-bd-limit
```

Nach Abschluss aller Sub-Schritte:
```powershell
git push origin task/M8-005-solver-bd-limit
git checkout main
git pull origin main
git merge task/M8-005-solver-bd-limit
git push origin main
```

`pnpm generate-api` ist in **Sub-Schritt A nötig** (ShiftType-Schema-Änderung).
Nach Sub-Schritt A `vitest` prüfen — ggf. Test-Fixtures um `is_bereitschaftsdienst`
ergänzen falls Mock-ShiftType-Objekte verwendet werden.

## Abschluss

- **Datum:** 2026-05-29
- **Branch:** task/M8-005-solver-bd-limit
- **Commits:**
  - `0fe8bf6` feat(models): M8-005/A shift_type is_bereitschaftsdienst field + migration
  - `cfcc80b` feat(solver): M8-005/B max-bd-per-month constraint id + tarif constant
  - `7813dc0` feat(solver): M8-005/C solver shift is_bereitschaftsdienst snapshot field
  - `611a68c` feat(solver): M8-005/D bd snapshot propagation in mapping
  - `92e706b` feat(solver): M8-005/E max-bd-per-month hard constraint + tests
  - `docs: M8-005 abschluss + ADR max-bd-per-month` (F, aktuell)
- **Testergebnis:** 349 Backend-Tests grün, 5 skipped; Solver/Constraint-Tests JVM-Guard (kein Java 17+ in Test-Umgebung); ruff clean für alle M8-005-Scope-Dateien.
- **Offene Voraussetzungen:** Java 17+ (Eclipse Temurin 21) für Solver-Tests; Frontend-Edit-UI für `is_bereitschaftsdienst`-Flag ist Out of Scope (separater UI-Milestone).
