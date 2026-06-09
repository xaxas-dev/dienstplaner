# Spec: PlanPage Sidebar Redesign & DnD Cleanup

**Date:** 2026-06-09  
**Milestone:** M13-002  
**Scope:** UI/UX restructuring of PlanPage — keine Backend-Änderungen

---

## Ziel

Die Pläne-Seite wird workflow-orientiert umstrukturiert:
1. DnD-Chips direkt neben Modus-Umschalter (keine separate Toolbar darunter)
2. KpiBar entfällt als separate Zeile → KPIs in rechte Sidebar
3. Arzt-Sidebar nur im Besetzungs-Modus sichtbar
4. Rechte Sidebar wird Tab-Panel mit modusspezifischen Tabs

---

## A. PlanModeBar — draggable Chips

### Aktuell
- Chips neben Umschalter: `ShiftType`-Pills + Abwesenheits-Codes — nur Anzeige, kein DnD
- Separate `ShiftTypeDragBar` + `AbsenceTypeDragBar` darunter für DnD

### Neu
- Chips in PlanModeBar bekommen `useDraggable` mit vorhandenen Helpers:
  - `makeShiftTypeDragId(st.id)` aus `ShiftTypeDragBar.tsx`
  - `makeAbsenceDragId(type)` aus `AbsenceTypeDragBar.tsx`
- **Beide Modi** zeigen identische Chip-Auswahl: alle ShiftType-Chips + alle Abwesenheits-Chips
- Visueller Stil der Chips bleibt exakt wie heute in ModeBar (farbige Pills / beige Abwesenheits-Chips)
- Fokus-Filter-Buttons (`Alle` / Gruppen aus `filter_group`) ziehen aus gelöschter `ShiftTypeDragBar` in PlanModeBar um — positioniert rechts der Chips, links der CTAs
- Entfernt aus PlanModeBar: Wünsche-Button, Fairness-Button, Konflikte-Badge (alle → Sidebar)

### Prop-Änderungen PlanModeBar
- **Entfernt:** `conflictCount`, `onScrollToConflict`, `showWishes`, `onToggleWishes`, `wishCount`, `showFairness`, `onToggleFairness`
- **Bleibt:** `mode`, `onModeChange`, `shiftTypes`, `activeFilterGroups`, `onFilterGroupToggle`, `onFilterGroupClear`, `solverEnabled`, `isSolving`, `onSolve`

---

## B. Separate DnD-Bars entfallen

- `ShiftTypeDragBar`-Komponente und `AbsenceTypeDragBar`-Komponente werden gelöscht
- DnD-Block in PlanPage ([L784-793](../../frontend/src/features/plans/PlanPage.tsx#L784)) entfernt
- **Helper-Exports bleiben erhalten** (`parseShiftTypeDragId`, `makeShiftTypeDragId`, `parseAbsenceDragId`, `makeAbsenceDragId`) — PlanPage-DragEnd-Handler importiert diese weiter
  - Option A: Helpers in eigene Utility-Datei auslagern
  - Option B: Helpers inline in PlanModeBar definieren, PlanPage importiert von dort
  - **Entscheidung: Option B** — PlanModeBar ist nun die einzige DnD-Quelle für diese Typen; Helpers co-located

---

## C. PlanKpiBar entfällt

- `PlanKpiBar`-Render in PlanPage entfernt
- Komponente `PlanKpiBar.tsx` wird gelöscht
- KPI-Daten (Abdeckung%, Sparkline, openCount, conflictCount) wandern als **compacte KPI-Leiste** an den Kopf der rechten Sidebar

### KPI-Leiste in Sidebar (immer sichtbar, über Tabs)
```
| 74%  ▂▄▇▄▃▆▇  |  12 offen  |  3 Konflikte  |
```
- `coverage` + Sparkline links
- `openCount` + `conflictCount` rechts, conflictCount bei > 0 in warn-Farbe
- Klick auf Konflikte → setzt sidebarTab auf `'konflikte'`

---

## D. Arzt-Sidebar (DoctorDragSource) — nur Besetzungs-Modus

- `DoctorDragSource` wird in PlanPage nur gerendert wenn `mode === 'besetzung'`
- Im INA-Modus ausgeblendet — kein Arzt-DnD nötig (nur Dienst-Chips → Zellen)
- Keine Änderung an DoctorDragSource selbst

---

## E. Rechte Sidebar — neues `PlanSidebar.tsx`

Ersetzt `ContextPanel` + `FairnessSidebar`. Feste Breite 290px.

### Struktur
```
┌─────────────────────────────┐
│  KPI-Leiste (74% ▂▄▇ 3 K)  │  ← immer sichtbar
├─────────────────────────────┤
│  [Details] [Wünsche] [Fair] │  ← Tabs (modusspezifisch)
│           [Konflikte]       │
├─────────────────────────────┤
│                             │
│  Tab-Inhalt (scrollable)    │
│                             │
└─────────────────────────────┘
```

### Tabs nach Modus

| Tab | Besetzung | INA |
|-----|-----------|-----|
| Details | ✓ | ✓ |
| Konflikte | ✓ | ✓ |
| Wünsche | — | ✓ |
| Fairness | — | ✓ |

Standard-Tab bei Moduswechsel: Fallback auf `'details'` wenn aktiver Tab im neuen Modus nicht verfügbar.

### Tab-Inhalte

**Details**  
= heutiger ContextPanel-Inhalt vollständig übernehmen:
- Sektion "Ausgewählt" (Arzt-Info, employment%)
- Konflikte/Tarif-Warnings für gewählten Shift (mit Override-UI)
- Schichten im Monat + Schichttypen-Aufschlüsselung
- Wünsche des Arztes (kurze Preview-Liste, max 5)

**Konflikte**  
- Kompakte Liste aller `conflicts.conflicts` (shift_id, Datum, Typ)
- Liste offener Dienste `conflicts.open_shifts` (shift_id, Datum, Schichttyp)
- Klick auf Eintrag → `scrollToFirstMatch` (entsprechende Zelle scrollt + Highlight-Puls)
- Leerzustand wenn keine Konflikte

**Wünsche** (nur INA)  
- Toggle `showWishes` (Hint-Layer im Grid ein/aus) — Button oben im Tab
- Listenansicht aller Plan-Wünsche (Datum, Typ, Priorität)

**Fairness** (nur INA)  
- = heutiger FairnessSidebar-Inhalt vollständig übernehmen (Tabelle Arzt × Gruppe)

### State in PlanPage
```typescript
const [sidebarTab, setSidebarTab] = useState<'details' | 'wuensche' | 'fairness' | 'konflikte'>('details')

// Bei Moduswechsel: ungültigen Tab zurücksetzen
useEffect(() => {
  const validBesetzung = ['details', 'konflikte']
  const validIna = ['details', 'wuensche', 'fairness', 'konflikte']
  const valid = mode === 'besetzung' ? validBesetzung : validIna
  if (!valid.includes(sidebarTab)) setSidebarTab('details')
}, [mode])
```

---

## Betroffene Dateien

| Datei | Aktion |
|-------|--------|
| `components/PlanModeBar.tsx` | Chips draggable machen; Helpers einbinden; Fokus-Filter einziehen; Props anpassen |
| `components/ShiftTypeDragBar.tsx` | Löschen (Helpers nach PlanModeBar umgezogen) |
| `components/AbsenceTypeDragBar.tsx` | Löschen (Helpers nach PlanModeBar umgezogen) |
| `components/PlanKpiBar.tsx` | Löschen |
| `components/ContextPanel.tsx` | Inhalt in PlanSidebar.tsx übernehmen, dann löschen |
| `components/FairnessSidebar.tsx` | Inhalt in PlanSidebar.tsx übernehmen, dann löschen |
| `components/PlanSidebar.tsx` | Neu erstellen |
| `PlanPage.tsx` | Props anpassen; DnD-Bar-Block entfernen; KpiBar entfernen; DoctorDragSource konditional; PlanSidebar einbinden; sidebarTab-State; scrollToConflict-Prop weitergeben |
| `tests/ContextPanel.test.tsx` | Auf PlanSidebar umstellen |
| `tests/FairnessSidebar.test.tsx` | Auf PlanSidebar umstellen |

---

## Tests

- `PlanSidebar.test.tsx` neu: Tab-Switching, KPI-Anzeige, Modus-abhängige Tabs
- `PlanModeBar.test.tsx` erweitern: DnD-Attribute auf Chips prüfen, Fokus-Filter in ModeBar
- Gelöschte Komponenten-Tests entfernen/umstellen

---

## Out of Scope

- Keine Backend-Änderungen
- Kein neues Design-Token
- Keine Änderung an Grid-Komponenten oder DnD-Logik in PlanPage
- Solver-Panel bleibt unverändert
