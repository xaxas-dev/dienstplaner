# M2-007: Unified Plan Grid (Excel-Replikat)

## Ziel
Die bisherige Dual-Tab-Ansicht (Bereiche-Ansicht + Dienste-Ansicht) durch ein einheitliches
Excel-artiges Grid ersetzen. Zeilen = (Bereich, Arzt)-Paare; Spalten = Tage des Monats.
Zwei DnD-Quellen: Doctor-Tokens (Rotationszuweisung) und ShiftType-Chips (Schichtzuweisung).

## Sub-Schritte

- [x] A: `Department.color` — Alembic-Migration + Model + Schemas + Tests
- [x] B: `GET /api/plans/{id}/absences` — Service + Endpoint + Tests
- [x] C: `bereichColors.ts` + `unifiedGridUtils.ts` + vitest-Tests
- [x] D: `UnifiedPlanGrid` + `UnifiedShiftCell` + `BereichHeaderRow` Komponenten
- [x] E: `ShiftTypeDragBar` + DnD-Verdrahtung in `PlanPage`
- [x] F: `PlanPage` umbauen (Tabs raus, Fokus-V/N-Toggle)
- [x] G: Alte Dateien löschen (`PlanGrid`, `RotationGrid`, `planGridUtils`, `rotationGridUtils`), Tests reparieren
- [x] H: `DepartmentForm` Color-Picker
- [x] I: CLAUDE.md + ADRs + Docs (Milestone-Abschluss)

## Abschluss

**Datum:** 2026-05-27
**Branch:** `task/M2-007-unified-plan-grid`

**Commits:**
- `feat(plans): M2-007/A department color field — migration, schema, tests`
- `feat(plans): M2-007/B GET /api/plans/{id}/absences endpoint`
- `feat(plans): M2-007/C frontend utilities + types for unified grid`
- `feat(plans): M2-007/D unified grid components`
- `feat(plans): M2-007/E ShiftTypeDragBar + findShiftId helper`
- `feat(plans): M2-007/F PlanPage unified grid - remove tabs, add focus toggle`
- `feat(plans): M2-007/G remove PlanGrid/RotationGrid, update tests`
- `feat(plans): M2-007/H department color picker + PlanPage cleanup`
- `docs: M2-007/I milestone closure — ADRs, CLAUDE.md, task briefing`

**Testergebnis:**
- Backend: alle Tests grün (inkl. 3 neue Department-Color-Tests, 7 neue Plan-Absences-Tests)
- Frontend: 32 Test-Dateien, 193 Tests — alle grün
- TypeScript: keine Fehler

**ADRs:** ADR-077, ADR-078, ADR-079, ADR-080

**Gelöschte Dateien:**
- `frontend/src/features/plans/components/PlanGrid.tsx`
- `frontend/src/features/plans/components/RotationGrid.tsx`
- `frontend/src/features/plans/planGridUtils.ts`
- `frontend/src/features/plans/rotationGridUtils.ts`
- `frontend/src/features/plans/tests/PlanGrid.test.tsx`
- `frontend/src/features/plans/tests/PlanGrid.tarifWarnings.test.tsx`
- `frontend/src/features/plans/tests/RotationGrid.availability.test.tsx`
- `frontend/src/features/plans/tests/planGridUtils.test.ts`
- `frontend/src/features/plans/tests/rotationGridUtils.test.ts`
