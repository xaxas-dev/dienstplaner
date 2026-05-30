# Task M9-001: Solver-Review-&-Apply-UI

## Ziel

Frontend-Integration des Phase-B-Solvers: Planende können den Solver per Button
anstoßen, den Vorschlag-Diff einsehen und mit einem Klick auf den Plan anwenden.
Backend-Endpunkte `POST /api/plans/{id}/solve` (M8-001) und
`POST /api/plans/{id}/apply` (M8-002) waren bereits vollständig — M9-001 liefert
den fehlenden Frontend-Consumer.

## Bindende Entscheidungen

1. **Modal-Pattern für Solver-Diff (ADR-084):** `SolverResultPanel` öffnet als
   Overlay (nicht inline im Grid). Begründung: Diff kann viele Zeilen haben;
   Modal erlaubt vollständige Tabelle ohne Grid-Layout-Eingriff. Schließen setzt
   `solveResult`-State zurück.

2. **JVM-Unavailable → eigener Toast (ADR-085):** HTTP-503 vom `/solve`-Endpunkt
   wird als `JvmUnavailableError` geworfen und in `handleSolve` separat mit
   klarem Hinweis behandelt: „Java-Laufzeitumgebung nicht verfügbar." Generische
   Solver-Fehler erhalten eigene Toast-Message.

3. **SolverDiffRows per `useMemo`:** `buildSolverDiff(shifts, doctors, proposed)`
   ist pure Funktion (kein API-Aufruf), wird in `PlanPage` per `useMemo` aus
   aktuellem Shift-State + `solveResult` abgeleitet. Kein eigener Query-Key.

4. **Apply-Response-Handling:** `ApplyResult.applied_count` + `skipped_pinned`
   werden im Success-Toast angezeigt. Client invalidiert `shifts`, `conflicts`
   und `tarifWarnings` nach Apply (keine optimistic updates, konsistent mit
   ADR-043).

5. **Button-Placement:** „Plan generieren"-Button mit Zap-Icon in
   `CommandBar extras` (sekundäre Aktionen), nicht im primary-slot. Begründung:
   Solver-Aufruf ist selten; primary-slot ist für häufige Aktionen reserviert.

## Umgesetzte Sub-Schritte

### A — Solver-Hooks, Utils und Tests
- `frontend/src/lib/types.ts`: Re-Exporte `SolveResult`, `ProposedAssignment`,
  `ApplyRequest`, `ApplyResult`
- `features/plans/useSolvePlan.ts`: TanStack-Mutation, `POST .../solve`,
  `JvmUnavailableError` bei HTTP-503
- `features/plans/useApplySolverResult.ts`: TanStack-Mutation, `POST .../apply`,
  invalidiert `shifts` + `conflicts` + `tarifWarnings`
- `features/plans/solverUtils.ts`: `buildSolverDiff()` pure Funktion,
  `SolverDiffRow`-Typ
- Bugfix: `absenceCode(FORTBILDUNG)` `'FB'` → `'Fo'` (CLAUDE.md-Konvention)
- 17 neue Tests, alle 204 Frontend-Tests grün

### B — SolverResultPanel-Komponente
- `features/plans/components/SolverResultPanel.tsx`: Modal mit Feasibility-Badge,
  Hard-/Soft-Score, Diff-Tabelle (Datum | Schichttyp | Aktuell → Vorschlag),
  Footer mit „Schließen" und „Alle anwenden (N)"-Button
- Bugfix: `doctorName()` nutzt `name`-Feld (nicht `first_name`/`last_name`)

### C — PlanPage-Integration
- „Plan generieren"-Button (Zap-Icon) in `CommandBar extras`
- `useSolvePlan` + `useApplySolverResult` in `PlanPage.tsx` verdrahtet
- `solverDiffRows` via `useMemo`
- `handleSolve`: 503 → JVM-Toast, andere Fehler → Solver-Fehler-Toast
- `SolverResultPanel` öffnet bei Solve-Erfolg; Apply schließt Panel + Success-Toast
  (mit Hinweis auf übersprungene gepinnte Schichten)

## Akzeptanzkriterien (alle erfüllt)

- [x] `useSolvePlan` und `useApplySolverResult` implementiert und getestet
- [x] `buildSolverDiff` implementiert und getestet
- [x] `SolverResultPanel` zeigt Feasibility, Score, Diff-Tabelle, Apply-Button
- [x] JVM-Fehler (503) erzeugt eigenen informativen Toast
- [x] Apply invalidiert Shifts + Conflicts + TarifWarnings
- [x] Gepinnte Schichten werden bei Apply übersprungen, im Toast kommuniziert
- [x] Alle 204 Frontend-Tests grün
- [x] TypeScript strict mode, keine `any`

## Out of Scope

- Solver-Constraints-Anzeige im Diff (welcher Constraint wurde verletzt)
- Score-Breakdown pro Constraint
- Teilweise Anwendung des Solver-Vorschlags (selektiv anwenden)
- Solver-Fortschrittsanzeige (JVM-Warmup-Zeit)
- Override-Mechanismus A/B/C im Frontend

## Abschluss

- **Datum:** 2026-05-29
- **Branch:** task/M9-001-solver-ui (direkt auf main gemergt via feature commits)
- **Commits:**
  - `c66c96f` feat(plans/solver): M9-001/A Solver-Hooks, Utils und Tests
  - `73a13ff` feat(plans/solver): M9-001/B SolverResultPanel-Komponente
  - `ac2cbb0` feat(plans/solver): M9-001/C PlanPage Solver-Integration
- **Testergebnis:** 204 Frontend-Tests grün; keine Backend-Änderungen.
- **Offene Voraussetzungen:** Java 17+ (Eclipse Temurin 21) für den Solver-Aufruf
  zur Laufzeit — Frontend zeigt informativen Toast wenn JVM fehlt.
