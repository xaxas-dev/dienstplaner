# Task M2-006: Plan-Grid Raster-Sichtbarkeit

## Ziel
Das PlanGrid ist optisch schwer ablesbar, weil es ohne Flächen-Abgrenzung auf
dem Papier-Hintergrund liegt und leere Zellen kaum sichtbare Trennlinien haben.
Diese Aufgabe legt das Grid auf eine design-konforme Card-Fläche (analog zur
§10-Tabellen-Konvention der Design-Anleitung), verstärkt die Raster-Linien und
bereinigt hartkodierte Wochenend-Hex-Farben. Rein visuelle Änderung, keine
Logik-, API- oder Datenmodell-Anpassung.

## Kontext (Leseanleitung)
1. `CLAUDE.md` (Abschnitt „Frontend — Plan-Feature (M2-003)")
2. `docs/design-implementation.md` §1 (Farb-/Radius-Tabelle), §7 (Plan-Grid),
   §10 (Tabellen-Frame-Konvention), §15 (keine Magic-Hex außerhalb der Tokens)
3. `tasks/done/M2-003-plan-frontend.md`
4. `frontend/src/features/plans/PlanPage.tsx`
5. `frontend/src/features/plans/components/PlanGrid.tsx`
6. `frontend/src/components/dp/ShiftCell.tsx`
7. `frontend/src/lib/design/tokens.ts`, `frontend/tailwind.config.ts`

## Ergebnis (abgeschlossen)

### Sub-Schritt 1 — Surface-Container + Sticky-Zellen + Token-Hygiene ✅
- `PlanPage.tsx`: `<PlanGrid>` in `rounded-2xl border border-line bg-card overflow-hidden`-Wrapper
- `PlanGrid.tsx`: Sticky-Zellen `bg-paper` → `bg-card`
- `PlanGrid.tsx`: `bg-[#F3ECD8]` / `bg-[#F3ECD8]/40` → `bg-weekend` / `bg-weekend/40`

### Sub-Schritt 2 — Leere Zellen ablesbar machen ✅
- `ShiftCell.tsx`: `border-dashed border-line/60` → `border border-line bg-paper/50`
- Hover: `hover:bg-card hover:border-line-2`

### Sub-Schritt 3 — In weitere Planung einbeziehen ✅
- `docs/design-implementation.md` §7: Surface-Container-Konvention dokumentiert
- `CLAUDE.md`: Lern-Bullet ergänzt (Grid-Surface, Sticky-bg-card, bg-card = Weiß)

## Akzeptanzkriterien (alle erfüllt)
- [x] Raster klar gegen Papier abgegrenzt, leere Zellen sichtbar
- [x] Sticky-Spalte ohne papierfarbene Naht beim Horizontal-Scroll
- [x] Keine Magic-Hex-Farben in `PlanGrid.tsx`
- [x] `pnpm type-check` + alle 101 vitest-Tests grün
- [x] Design-Anleitung §7 + CLAUDE.md aktualisiert
