# Task M7-002: Dashboard „Heute" Fertigstellung

## Ziel

Die Dashboard-Seite `/heute` von Platzhalter auf vollständige Implementierung
laut [docs/design-implementation.md §8](../../docs/design-implementation.md)
bringen. Phase-A-konform: read-only Aggregation, kein Schreibpfad-Eingriff,
kein Solver.

## Kontext

- Aktueller Stand (vor M7-002): `TodayPage.tsx` zeigte nur Greeting + Dashed-Platzhalter
  und verwies fälschlich auf M2-003.
- M2-003 (Plan-Frontend) ist abgeschlossen und lieferte den PlanGrid, nicht das
  Dashboard. Der Verweis im Code war veraltet.
- Spec §8 fordert: Greeting + KPI-Strip + „Heute im Dienst" + Aufmerksamkeit +
  Coverage-Bars + CTA in 2-Spalten-Layout (`1.4fr / 1fr`, 28 px gap).
- „Aktueller Plan" = neuester Plan, dessen Monat heute enthält (per neuem
  Backend-Endpunkt `GET /api/plans/current`).

## Kerndeliverables

1. **Backend `GET /api/plans/current` (A)** — Resolver für Plan, dessen
   `[valid_from, valid_to]` heute enthält. `204` falls keiner.
   Route VOR `/{plan_id}` definiert (Routing-Reihenfolge!).
2. **Backend Dashboard-Summary (B)** — `GET /api/plans/{id}/dashboard?today=`,
   liefert aggregierte KPIs + Today-Shifts + Coverage-by-Department + Attention
   in einer Response. Service `dashboard_service.py`, Schema `dashboard.py`.
   Wiederverwendung von `conflict_service.detect_conflicts`.
3. **Frontend Hooks (C)** — `useCurrentPlan`, `useDashboardSummary` in
   `features/today/`. Query-Keys `currentPlanKeys`, `dashboardKeys`.
4. **TodayPage komplett neu (D)** — 2-Spalten-Layout laut Spec §8.
   Inline-Komponenten: `GreetingBlock`, `DutyShiftRow`, `AttentionRow`,
   `CoverageBar`, `CtaCard`. Empty-State explizit.
5. **Doku + Cleanup (E)** — `design-implementation.md` Route korrigiert,
   M2-003-Kommentar in `DoctorCard.tsx` entfernt, CLAUDE.md-Pattern ergänzt.
6. **Milestone-Abschluss (F)** — ADRs 068–070, Roadmap, Checkliste.

## Akzeptanzkriterien

- [x] `GET /api/plans/current` liefert 200+Plan oder 204 (Empty); Tests grün.
- [x] `GET /api/plans/{id}/dashboard` liefert vollständige `DashboardSummary`;
      Tests grün (Coverage-%, Konflikte-Count, Today-Shifts, Empty-Cases).
- [x] `/heute` zeigt Greeting mit Kicker (Wochentag · Datum · KW) und H1
      (Newsreader 38 px) mit italic-Akzent „Heute" in `text-accent`.
- [x] 4 KPI-Tiles befüllt (Abdeckung %, Offene Schichten, Regelkonflikte,
      Im Urlaub); Konflikte > 0 → `tone="warn"`.
- [x] „Heute im Dienst"-Card: pro Schichttyp eine Zeile (Dot + Name +
      Doctor-Avatars).
- [x] Rechte Spalte: Aufmerksamkeits-Liste, Coverage-Bars per Station, dunkle
      CTA-Karte.
- [x] Empty-State (kein currentPlan): KPIs mit „—", Karten mit
      „Kein Plan für diesen Monat", CTA → `/plans/new`.
- [x] CTA-Link führt zu `/plans/{currentPlan.id}` bzw. `/plans/new`.
- [x] Backend pytest grün, Frontend vitest grün, `pnpm typecheck` clean.
- [x] Dashboard schreibt nirgends in DB (nur GETs verifiziert).

## Sub-Schritte mit Stop-Gates

- **A** `feat(api): GET /api/plans/current resolves plan by today`
- **B** `feat(api): dashboard summary endpoint`
- **C** `feat(frontend): dashboard hooks (useCurrentPlan, useDashboardSummary)`
- **D** `feat(today): full dashboard per spec §8`
- **E** `docs(M7-002): dashboard implementation patterns`
- **F** `chore(M7-002): milestone closure`

## Architektur-Entscheidungen (Vorab-Festlegung)

- **204 statt 404** für „kein aktueller Plan" (kein echter Fehler, sondern
  legitimer Empty-State).
- **Eine Dashboard-Summary-Response** statt N Einzel-Hooks (atomare
  Konsistenz, weniger Roundtrips).
- **„Aufmerksamkeit"-Items abgeleitet** aus bestehenden Quellen (Konflikte
  heute + Open-Shifts heute + Upcoming-Absences). Kein neues Datenmodell.
- **Keine neuen `dp/`-Primitives** — alle Dashboard-spezifischen Komponenten
  inline in `features/today/`.

## Was NICHT in diesen Milestone gehört

- Solver-Integration (Phase B).
- Schreibpfad-Erweiterungen.
- Neue Constraint-Regeln.
- ⌘K Command Palette (separater Milestone, siehe Spec §11).
- Aufmerksamkeits-Persistenz (Items werden zur Render-Zeit abgeleitet).

## Abschluss

- **Datum:** 2026-05-24
- **Branch:** task/M7-002-dashboard-heute
- **Commits:**
  - `feat(api): GET /api/plans/current resolves plan by today` (1de9bf8)
  - `feat(api): dashboard summary endpoint` (96d17ed)
  - `feat(frontend): dashboard hooks (useCurrentPlan, useDashboardSummary)` (9a0c592)
  - `feat(today): full dashboard per spec §8` (5f0b1fa)
  - `docs(M7-002): dashboard implementation patterns` (b2c02ac)
  - `chore(M7-002): milestone closure` (finale)
- **Testergebnis:**
  - Backend pytest: ✅ 331 passed, 26 skipped
  - Frontend vitest: ✅ 176 passed (32 Test-Files), inkl. 11 neue TodayPage-Tests
  - TypeScript: ✅ pnpm tsc --noEmit clean
- **ADRs:** ADR-068 (204-Empty-State), ADR-069 (aggregierter Endpunkt), ADR-070 (Attention-Items abgeleitet)
- **Offene Voraussetzungen:** keine — Dashboard ist read-only, kein Solver nötig
