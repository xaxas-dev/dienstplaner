# Task M8-002: Solver-Apply-Endpoint

## Ziel

Den read-only Solver-Vorschlag aus M8-001 in den Plan schreibbar machen.
Ein neuer Endpoint `POST /api/plans/{plan_id}/apply` nimmt eine Liste von
`ProposedAssignment`-Objekten (exakt das Format, das `/solve` zurückliefert)
und schreibt die Arzt-Zuweisungen in die DB.

**Weiche Validierung wie M2-004:** Nur Datenkonsistenz wird hart geprüft
(Plan existiert, Shift gehört zum Plan, Doctor existiert + aktiv). Semantische
Constraints (Verfügbarkeit, Doppelbuchung) blockieren den Schreibpfad NICHT —
sie werden weiterhin read-only über die Konflikt-Engine berechnet und sind
beim nächsten `GET /plans/{id}/shifts` sichtbar.

**Kein JVM/timefold im Apply-Pfad.** Der Apply-Endpoint ist ein reiner DB-Write
ohne Solver-Aufruf. Die Phase-A-App startet weiterhin ohne Java-Installation.

**Anwenden ≠ Pinnen.** Solver-Vorschläge werden ungepinnt übernommen
(`is_pinned` bleibt `False`). Der Plan bleibt re-solvebar; der Nutzer pinnt
gezielt, was er dauerhaft fixieren will.

## Bindende Entscheidungen

1. **Apply-Quelle:** Request-Body mit `proposed_assignments: list[ProposedAssignment]`.
   Kein server-seitiges Re-Solve — der Client übergibt den Diff, den er von
   `/solve` erhalten hat (Review vor Apply möglich).
2. **Pin-Verhalten:** Geschriebene Shifts bleiben ungepinnt (`is_pinned` wird
   im Apply-Pfad nicht gesetzt).
3. **Stale-Schutz:** Shifts, die seit dem `/solve`-Aufruf auf `is_pinned=True`
   gesetzt wurden, werden übersprungen (nicht überschrieben) und in
   `skipped_pinned: list[int]` zurückgegeben. Konsistent mit Pin-Konzept.
4. **Konflikte:** nicht in der Apply-Response berechnen. Decoupling wie ADR
   M2-005 — Client invalidiert und refetcht `shifts`+`conflicts` nach Erfolg.
5. **Fehlerformat:** bestehende Konvention (`{"detail": "..."}` via
   `error_handlers.py`) — kein neues RFC-9457-Format.
6. **Transaktion:** alle Zuweisungen in einem `db.commit()`. Bei
   Validierungsfehler → 422, kein Teil-Write.

## Kontext (Leseanleitung)

1. `CLAUDE.md` (Phasenmodell, „Weiche Validierung", Pin-Konzept, solver/-Konvention)
2. `docs/data-model.md` (Pin-Konzept, Hybrid-Modell, RotationAssignment)
3. `docs/constraints.md` (Constraint-Klassen; Apply prüft keine)
4. `docs/decisions.md` (ADR-006, ADR-011, M2-005 Konflikt-Decoupling)
5. `backend/app/schemas/solve.py` (ProposedAssignment, SolveResult — neu: ApplyRequest, ApplyResult)
6. `backend/app/solver/solver_service.py` (solve_plan — neu: apply_solution)
7. `backend/app/services/shift_service.py` (Doctor-Validierungslogik wiederverwenden)
8. `backend/app/repositories/shift_repository.py` (update_shift, get_shift)
9. `backend/app/api/plans.py` (bestehende /solve-Route als Vorlage)
10. `backend/app/api/error_handlers.py` (PlanNotFoundError → 404)
11. `tasks/done/M8-001-solver-skeleton.md` (Vorgänger-Milestone)

## Phase-A-Invariante

Keine inhaltliche Änderung an `conflict_service.py`, `plan_shifts.py`,
`shifts.py`, Modellen oder bestehenden Schreibpfaden. `git diff` zeigt nur
additive Änderungen: neue Schemas, neue Service-Funktion, neue Route, neue Tests.

## Sub-Schritte (Stop-Gate: nach jedem Schritt Commit + Review)

### Sub-Schritt A — Schemas

**Datei:** `backend/app/schemas/solve.py`

`ProposedAssignment` existiert bereits — **nicht duplizieren**, direkt
wiederverwenden.

Neu hinzufügen:

```python
class ApplyRequest(BaseModel):
    proposed_assignments: list[ProposedAssignment]
    model_config = ConfigDict(extra="forbid")


class ApplyResult(BaseModel):
    plan_id: int
    applied: list[int]        # shift_ids, die geschrieben wurden
    skipped_pinned: list[int] # shift_ids, die wegen is_pinned übersprungen wurden
```

**Akzeptanzkriterien Sub-Schritt A:**
- [x] `ApplyRequest` und `ApplyResult` in `solve.py` vorhanden
- [x] `ProposedAssignment` nicht dupliziert
- [x] `model_config = ConfigDict(extra="forbid")` in `ApplyRequest`
- [x] `ruff check` clean

**Stop-Gate nach Sub-Schritt A:**
Commit `feat(solver): M8-002/A apply request/result schemas`, auf Review warten.

---

### Sub-Schritt B — Service `apply_solution()`

**Datei:** `backend/app/solver/solver_service.py`

Neue Funktion hinzufügen (kein `import timefold` in diesem Pfad):

```python
def apply_solution(
    db: Session,
    plan_id: int,
    proposed: list[ProposedAssignment],
) -> ApplyResult:
    """Schreibt Solver-Vorschläge in den Plan. Kein JVM-Import nötig."""
```

**Implementierungslogik:**

1. Plan-Existenz prüfen → `PlanNotFoundError(plan_id)` wenn nicht vorhanden
   (gleiche Konvention wie `solve_plan`).
2. Alle betroffenen Shift-IDs in einer Transaktion verarbeiten:
   - Shift laden (`shift_repo.get_shift(db, shift_id)`).
   - Shift gehört nicht zu `plan_id` → `ShiftValidationError` (422).
   - `doctor_id is not None` → Doctor existiert + aktiv prüfen
     (Logik aus `shift_service.update_shift` extrahieren/wiederverwenden —
     NICHT neu implementieren).
   - `shift.is_pinned == True` → überspringen, `shift_id` in
     `skipped_pinned` aufnehmen. Kein Fehler.
   - Sonst: `shift_repo.update_shift(db, shift_id, {"doctor_id": doctor_id})`.
     `is_pinned` wird **nicht** gesetzt.
3. Ein `db.commit()` am Ende (nicht pro Shift).
4. `ApplyResult(plan_id=plan_id, applied=[...], skipped_pinned=[...])` zurückgeben.

**Unit-Tests** in `backend/tests/unit/test_solver_service.py`:

| Test | Was wird geprüft |
|------|-----------------|
| `test_apply_solution_schreibt_doctor_id` | doctor_id in DB nach Apply sichtbar |
| `test_apply_solution_gepinnter_shift_wird_uebersprungen` | is_pinned=True → skipped_pinned, DB unverändert |
| `test_apply_solution_unbekannter_shift_gibt_422` | Shift-ID nicht in Plan → Fehler |
| `test_apply_solution_inaktiver_doctor_gibt_422` | inaktiver Arzt → Fehler |
| `test_apply_solution_fremder_plan_gibt_422` | Shift aus anderem Plan → Fehler |
| `test_apply_solution_plan_nicht_gefunden` | plan_id unbekannt → PlanNotFoundError |
| `test_apply_solution_is_pinned_bleibt_false` | is_pinned nach Apply weiterhin False |

Jeder Constraint braucht positiven **und** negativen Test (CLAUDE.md-Konvention).
Tests dürfen **nicht** durch JVM-Guard (`pytestmark.skipif`) übersprungen werden —
Apply braucht kein timefold.

**Akzeptanzkriterien Sub-Schritt B:**
- [x] `apply_solution()` in `solver_service.py` implementiert
- [x] Kein `import timefold` im Apply-Pfad
- [x] Alle 7 Unit-Tests vorhanden und grün
- [x] Gesamter `pytest` bleibt grün (keine Regression)
- [x] `ruff check` clean

**Stop-Gate nach Sub-Schritt B:**
Commit `feat(solver): M8-002/B apply_solution service + tests`, auf Review warten.

---

### Sub-Schritt C — API-Endpoint + Integrationstests

**Datei:** `backend/app/api/plans.py`

Neue Route hinzufügen (unterhalb der `/solve`-Route):

```python
@router.post("/{plan_id}/apply", response_model=ApplyResult)
def apply_plan(
    plan_id: int,
    body: ApplyRequest,
    db: Session = Depends(get_db),
) -> ApplyResult:
    return solver_service.apply_solution(db, plan_id, body.proposed_assignments)
```

Keine Business-Logik in `api/` (Konvention CLAUDE.md).

**Integrationstests** in `backend/tests/integration/test_apply_api.py`
(neue Datei, parallel zu `test_solve_api.py`):

| Test | Was wird geprüft |
|------|-----------------|
| `test_apply_200_gibt_apply_result_zurueck` | HTTP 200, ApplyResult-Felder vorhanden |
| `test_apply_schreibt_doctor_in_db` | DB-Shift hat nach Apply die neue doctor_id |
| `test_apply_404_unbekannter_plan` | plan_id nicht vorhanden → 404 |
| `test_apply_gepinnter_shift_in_skipped_pinned` | gepinnter Shift in skipped_pinned, DB unverändert |
| `test_apply_is_pinned_bleibt_false` | is_pinned nach Apply weiterhin False |
| `test_apply_422_bei_leerem_body` | fehlende proposed_assignments → 422 |

Nach Implementierung und grünen Tests:
```powershell
pnpm --prefix frontend generate-api
```
(OpenAPI-Typen aktualisieren — neuer Endpoint + neue Schemas).

**Akzeptanzkriterien Sub-Schritt C:**
- [x] `POST /api/plans/{plan_id}/apply` erreichbar und liefert `ApplyResult`
- [x] Alle 6 Integrationstests vorhanden und grün
- [x] `pnpm generate-api` ohne Fehler ausgeführt
- [x] Gesamter `pytest` (237+) grün, gesamter `vitest` grün
- [x] `ruff check` clean

**Stop-Gate nach Sub-Schritt C:**
Commit `feat(solver): M8-002/C apply endpoint + integration tests`, auf Review warten.

---

### Sub-Schritt D — Abschluss-Dokumentation

Pflichtschritte laut CLAUDE.md-Milestone-Abschluss-Checkliste:

1. **`tasks/open/M8-002-solver-apply-endpoint.md`** → `tasks/done/` verschieben;
   alle `[ ]` → `[x]`; Abschnitt „Abschluss" anhängen (Datum, Branch, Commits,
   Testergebnis).
2. **`docs/open-questions.md`**: neue offene Fragen eintragen; beantwortete
   Fragen auf Status „Entschieden" setzen.
3. **`docs/decisions.md`**: ADR für Apply-Design (Body-Quelle, ungepinnt,
   Stale-Skip, Konflikt-Decoupling — Verweis auf M2-005).
4. **`docs/constraints.md`**: Hinweis ergänzen, dass `POST /apply` keine
   Constraint-Prüfung erzwingt (weiche Validierung Phase A).
5. **`CLAUDE.md`**: Domänen-Konzept-Eintrag „Solver-Vorschlags-Diff" erweitern:
   `POST /api/plans/{id}/apply` ergänzen (ungepinnt, stale-skip, kein JVM).

**Stop-Gate nach Sub-Schritt D:**
Commit `docs: M8-002 Abschluss + ADRs + CLAUDE.md`, auf Review warten.

---

## Akzeptanzkriterien (Gesamtaufgabe)

- [x] `ApplyRequest` und `ApplyResult` in `schemas/solve.py`
- [x] `apply_solution()` in `solver_service.py` — kein timefold-Import
- [x] `POST /api/plans/{plan_id}/apply` liefert 200 + `ApplyResult`
- [x] 404 bei unbekanntem plan_id
- [x] 422 bei ungültigen Daten (inaktiver Arzt, Shift fremdem Plan)
- [x] Gepinnter Shift → `skipped_pinned`, DB unverändert
- [x] `is_pinned` nach Apply weiterhin `False`
- [x] DB-Shift hat nach Apply die neue `doctor_id`
- [x] Alle neuen Unit- und Integrationstests grün
- [x] Gesamter `pytest` (Baseline nach M8-001: 237 passed) grün
- [x] Gesamter `vitest` (101) grün
- [x] `pnpm generate-api` ausgeführt und fehlerfrei
- [x] `ruff check` clean, `enum.StrEnum`-Konvention im neuen Code
- [x] Milestone-Abschluss-Checkliste (Schritt D) vollständig

## Out of Scope

- Frontend-UI / Hook zum Reviewen und Anwenden des Diffs (eigener Folge-Milestone)
- Server-seitiges Re-Solve im Apply-Pfad
- Automatisches Pinnen von Apply-Zuweisungen
- Undo/Redo-Funktionalität
- Partielles Apply (nur ausgewählte Vorschläge per UI)
- Weitere Solver-Constraints (kommen in M8-003+)

## Bekannte Stolperfallen

- **Keine semantische Validierung einbauen.** Apply darf nur Datenkonsistenz
  prüfen (Plan, Shift, Doctor existieren). Verfügbarkeit, Qualifikation,
  Doppelbuchung blockieren den Write NICHT — weiche Validierung (CLAUDE.md).
- **`is_pinned` nicht anfassen.** Nicht das Verhalten aus `shift_service.update_shift`
  kopieren, das bei manueller Zuweisung pinnt. Solver-Apply ist nicht manuell.
- **Kein timefold-Import.** Apply braucht keinen Solver-Aufruf. Falls timefold
  trotzdem importiert wird, würden Tests durch JVM-Guard skippen — das wäre falsch.
- **Shift-Ownership validieren.** Shift.plan_id muss `plan_id` aus dem
  Route-Parameter entsprechen — sonst 422, kein 404.
- **Konflikte nicht in der Response berechnen.** `detect_conflicts` nicht im
  Apply aufrufen — Decoupling wie ADR M2-005 / `GET /plans/{id}/shifts`.
- **Transaktion.** Nicht pro Shift committen; einmal am Ende. Bei Fehler darf
  kein Teil-Write in der DB landen.

## Annahmen

- `ProposedAssignment` aus `schemas/solve.py` wird unverändert wiederverwendet
  (kein neuer Typ).
- Die Doctor-Validierungslogik aus `shift_service.update_shift` kann extrahiert
  oder direkt aufgerufen werden (kein Reimplementieren).
- `shift_repo.get_shift()` und `shift_repo.update_shift()` decken den
  Datenzugriff ab — kein neues Repository-Muster nötig.
- `plans.py` ist der korrekte Router für Plan-bezogene Endpoints (analog `/solve`).

Bei Unklarheit: `tasks/done/M8-001-solver-skeleton.md` und bestehenden Code
als Referenz nutzen, dann hier ergänzen und stoppen.

## Workflow-Reminder (Branch und Merge)

Vor Start:

```powershell
cd D:\Softwareprojekte\Dienstplaner
git status
git checkout main
git pull origin main
git checkout -b task/M8-002-solver-apply-endpoint
```

Briefing liegt in `tasks\open\M8-002-solver-apply-endpoint.md`.

Nach Abschluss aller Sub-Schritte:

```powershell
git push origin task/M8-002-solver-apply-endpoint
# PR erstellen oder direkt mergen nach Review
git checkout main
git pull origin main
git merge task/M8-002-solver-apply-endpoint
git push origin main
```

`pnpm generate-api` wurde in Sub-Schritt C ausgeführt (neue OpenAPI-Typen).

## Abschluss

**Status:** Vollständig abgeschlossen (2026-05-19). Branch
`task/M8-002-solver-apply-endpoint` bereit für Merge in `main`.

**Commits (A–D):**
- A: `feat(solver): M8-002/A apply request/result schemas`
- B: `feat(solver): M8-002/B apply_solution service + tests`
- C: `feat(solver): M8-002/C apply endpoint + integration tests`
- D: `docs: M8-002 Abschluss + ADRs + CLAUDE.md`

**Testergebnis:** 278 passed, 0 skipped (JVM mit Eclipse Temurin 21 verfügbar;
alle Solver-Tests laufen durch). Davon 15 neue Tests (8 Unit + 7 Integration),
kein Regression.

**Nebeneffekt:** `tests/conftest.py` — `db`-Fixture um Table-Cleanup nach
jedem Test erweitert (nötig für Isolation wenn Services `db.commit()` aufrufen).

**Java-Voraussetzung:** Eclipse Temurin JDK 21 installiert unter
`C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot\`.
JAVA_HOME muss in den Windows-Systemumgebungsvariablen gesetzt werden
(oder per Session: `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"`).
Siehe OQ-002 in `docs/open-questions.md`.
