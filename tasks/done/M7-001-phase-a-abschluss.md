# Task M7-001: Phase-A-Abschluss & Polish

## Ziel

Phase A (Manueller Planungsassistent) formal abschließen: verbleibende UI-Polish-Punkte
umsetzen, einen Backend-Lifecycle-Smoke-Test ergänzen und alle Dokumentation auf
aktuellen Stand bringen.

## Kerndeliverables

1. **Logo (A)** — LogoMark.tsx mit neuem Sortier-D-SVG ersetzen, CSS-Keyframes für
   Pulse-Animation ergänzen, MiniRail verdrahten.
2. **Plan-Grid-Affordance (B)** — 3 visuelle Ebenen (A: Dot-Grid, D: Crosshair-Hover,
   E: Drag-Modus) in ShiftCell + PlanGrid implementieren.
3. **Arzt-Titel in DoctorCard (C)** — Titel-Feld vor dem Namen anzeigen (TDD).
4. **Backend-Lifecycle-Smoke-Test (D)** — End-to-End-Integrationstest von
   Doctor → ShiftType → Plan → Shift-Zuweisung → Konflikte → Excel-Export.
5. **Vollständiger Doku-Sweep (E)** — README, architecture.md, data-model.md,
   constraints.md, design-implementation.md, department_service.py TODO.
6. **Milestone-Abschluss (F)** — ADRs 065–067, CLAUDE.md-Patterns, Roadmap.

## Akzeptanzkriterien

- [x] LogoMark zeigt Sortier-D-SVG (kein Newsreader-Italic-„D" mehr).
- [x] Plan-Grid: leere Zellen haben Dot-Grid-Anker, Crosshair-Hover hebt Zeile+Spalte hervor.
- [x] DoctorCard zeigt Titel vor Name wenn vorhanden.
- [x] Smoke-Test läuft grün: `test_plan_lifecycle_smoke PASSED`.
- [x] Backend pytest vollständig grün (312 passed, 26 skipped).
- [x] Dokumentation ohne veraltete Platzhalter oder TODO-Marker.

## Abschluss

- **Datum:** 2026-05-22
- **Branch:** task/M7-001-phase-a-abschluss
- **Commits:**
  - `feat(ui): M7-001/A Sortier-D Logo` (17f7558)
  - `feat(ui): M7-001/B Grid-Affordance A+D+E` (4f99434)
  - `refactor(ui): M7-001/B DragState exportieren` (8d954f2)
  - `fix(ui): M7-001/B row-tint auf alle Zellen in gehoverter Reihe` (92d139c)
  - `feat(ui): M7-001/C Titel in Ärzte-Übersicht` (8739bf1)
  - `test: M7-001/D Plan-Lifecycle-Smoke` (6ee1ddc)
  - `docs: M7-001/E vollständiger Doku-Sweep` (3291ef8)
  - `docs: M7-001/E fix AppShell-Ref + fehlende Hooks in architecture.md` (1567353)
  - `docs: M7-001/F Abschluss + ADRs 065-067` (0e01006)
  - `feat(ui): Bereiche-Grid-Affordance, Titel-Select, Klinikname aus Rail entfernt` (75a48c9)
  - `fix(ui): Grid-Skalierung, Rail-Farbe, DoctorForm-SelectItem-Crash` (fcf10d7)
- **Testergebnis:** Backend pytest ✅ (312 passed, 26 skipped), Frontend vitest ✅ (10/10 DoctorCard)
- **Offene Voraussetzungen:** keine (Phase-B-Solver erfordert JVM, aber nicht für diesen Milestone)
