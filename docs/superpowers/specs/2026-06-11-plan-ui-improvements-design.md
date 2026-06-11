# Plan UI Improvements — Design Spec

**Date:** 2026-06-11  
**Status:** Approved  
**Scope:** 5 UI improvements to the plan grid, drag-and-drop, and command bar

---

## 1. "Arzt hinzufügen" in Header-Zeile

### Problem
`AddRotationRow` belegt eine eigene Grid-Zeile pro Station — verschwendeter vertikaler Platz, besonders bei vielen Stationen.

### Lösung
Button in `BereichHeaderRow` integrieren. Erscheint nur beim Hover der Header-Zeile.

### Änderungen

**`UnifiedPlanGrid.tsx` — `BereichHeaderRow`:**
- Prop `onAddRotation?: () => void` hinzufügen
- Label-Cell als `group`-Container: `+ Arzt`-Button mit `opacity-0 group-hover:opacity-100 transition-opacity`
- Kleines `+`-Icon (`size-3`) + optionaler Text, rechts neben dem Bereichsnamen
- Button-Click ruft `onAddRotation()` auf

**`UnifiedPlanGrid.tsx` — Grid-Render-Loop:**
- `AddRotationRow`-Funktion und alle Aufrufe entfernen
- `onAddRotation`-Prop aus `BereichHeaderRow`-Aufruf statt separatem `AddRotationRow`-Aufruf

**`UnifiedPlanGrid.tsx` — Props:**
- `onAddRotationForDept` bleibt (Callback-Signatur unverändert), wird jetzt an `BereichHeaderRow` weitergeleitet

### Nicht geändert
- `PlanPage.tsx` Callback-Signatur (`onAddRotationForDept`) bleibt identisch — kein Upstream-Refactor nötig

---

## 2. Drag-Spaltenhervorhebung

### Problem
Beim Ziehen eines Dienst-Chips (ShiftType) gibt es kein visuelles Feedback, wo dieser Dienst im aktuellen Plan noch fehlt.

### Lösung
Spalten **mit** bestehendem Dienst dimmen; Spalten **ohne** diesen Dienst grün highlighten.

### Datenfluss

```
handleDragStart (PlanPage)
  → activeDragShiftTypeId: number | null  (neuer State)
  → dragDimDays: Set<string>              (computed aus shiftsData)

PlanPage → UnifiedPlanGrid: dragDimDays?: Set<string>
UnifiedPlanGrid → UnifiedShiftCell: isDragDimmed: boolean, isDragHighlighted: boolean
UnifiedPlanGrid → Spaltenheader: isDragDimmed: boolean
```

### Berechnung `dragDimDays`

```ts
const dragDimDays = useMemo(() => {
  if (!activeDragShiftTypeId || !shiftsData) return undefined
  const days = new Set<string>()
  for (const shift of shiftsData) {
    if (shift.shift_type_id === activeDragShiftTypeId && shift.doctor_id !== null) {
      days.add(shift.shift_date) // ISO date string = dayKey
    }
  }
  return days
}, [activeDragShiftTypeId, shiftsData])
```

### Visuelle Regeln (UnifiedShiftCell)

| Zustand | CSS |
|---------|-----|
| `isDragDimmed` (Dienst vorhanden) | `opacity-30 grayscale` |
| `isDragHighlighted` (Dienst fehlt, drop target) | `ring-1 ring-inset ring-emerald-400/50 bg-emerald-50/20` |
| Keine Drag-Aktivität | Status quo |

- Highlight nur für Zellen der **gleichen ShiftType-Zeile** (INA-Modus: Rotation-Zeilen), nicht für alle Zellen der Spalte
- Tages-Header-Zellen: wenn `isDragDimmed` → `opacity-40`, sonst normal

### Reset
`handleDragEnd` / `handleDragCancel` → `activeDragShiftTypeId = null`

---

## 3. Popover am Cursor

### Problem
`DoctorAssignPopover` öffnet sich cell-verankert — je nach Scroll-Position weit vom Cursor entfernt.

### Lösung
Popover erscheint 8px unterhalb des Klick-Cursors, mit Viewport-Clamp.

### Änderungen

**`UnifiedShiftCell.tsx`:**
- `onClick`-Callback um `event: React.MouseEvent` erweitern: `onCellClick?: (shiftKey: boolean, event: React.MouseEvent) => void`
- Klick-Koordinaten via `event.clientX, event.clientY` weitergeben

**`UnifiedPlanGrid.tsx`:**
- `onCellClick` Signatur: `(row, dayKey, shiftKey, event: React.MouseEvent) => void`
- Event durchreichen

**`PlanPage.tsx`:**
- Neuer State: `cellClickPosition: { x: number; y: number } | null`
- In `handleCellClick`: `setCellClickPosition({ x: e.clientX, y: e.clientY + 8 })`
- Auf `null` zurücksetzen wenn Popover schließt

**`DoctorAssignPopover.tsx`:**
- Neues optionales Prop: `anchorPosition?: { x: number; y: number }`
- Wenn gesetzt: `position: fixed; left: x; top: y` via inline `style`
- Viewport-Clamp: `left = Math.min(x, window.innerWidth - popoverWidth - 8)`
- Kein Radix-Anchor mehr wenn `anchorPosition` gesetzt — eigenständiges `fixed`-Div

---

## 4. Settings-Icon Höhe

### Problem
Settings-Button (`<Settings/>`) ist kleiner als "Plan generieren"-Button — wirken nicht als Einheit.

### Lösung
Beide Buttons als Button-Group mit identischer Höhe und Padding; gemeinsamer Rahmen mit Trennlinie.

### Änderungen (`PlanModeBar.tsx`)

```tsx
// Vorher
<div className="flex items-center gap-px">
  <button ...>Plan generieren</button>
  <button ...><Settings/></button>
</div>

// Nachher — gleiche h, py, px; group border treatment
<div className="flex items-center">
  <button className="... rounded-l-md rounded-r-none border-r-0 h-8 px-3">
    <Zap/> Plan generieren
  </button>
  <button className="... rounded-l-none rounded-r-md border-l h-8 px-2.5">
    <Settings/>
  </button>
</div>
```

- Gemeinsamer Outer-Border via `ring`/`border` auf dem Container, oder je Button passende Border-Klassen
- `h-8` auf beiden — Settings-Icon bekommt `size-4` damit es im `h-8`-Button zentriert ist
- Kein `gap-px` mehr nötig wenn Border-Trennlinie via `border-l` auf Settings-Button

---

## 5. Drag-Icon am Cursor

### Problem
Beim Ziehen eines Dienst-Chips oder Abwesenheits-Chips gibt es kein visuelles Drag-Overlay — der Nutzer sieht nur den verschwindenden Chip.

### Lösung
`DragOverlay` in `PlanPage` rendert für alle drei Drag-Typen ein passendes Badge.

### Neue States (PlanPage)

```ts
activeDragShiftType: { id: number; shortName: string; bg: string; fg: string } | null
activeDragAbsence: { type: string; label: string } | null
// activeDragDoctor bereits vorhanden
```

### handleDragStart — Erweiterung

```ts
if (shiftTypeId) {
  const st = shiftTypes.find(s => s.id === shiftTypeId)
  if (st) setActiveDragShiftType({ id: st.id, shortName: st.short_name, bg: ..., fg: ... })
}
if (absenceType) {
  setActiveDragAbsence({ type: absenceType, label: absenceTypeLabel(absenceType) })
}
```

### DragOverlay

```tsx
<DragOverlay modifiers={[avatarTopModifier]}>
  {activeDragDoctor && <DoctorDragOverlayToken ... />}
  {activeDragShiftType && (
    <ShiftTypeOverlayChip shortName={activeDragShiftType.shortName} bg={activeDragShiftType.bg} fg={activeDragShiftType.fg} />
  )}
  {activeDragAbsence && (
    <AbsenceOverlayChip label={activeDragAbsence.label} />
  )}
</DragOverlay>
```

### Neue Komponenten (inline in PlanModeBar.tsx oder PlanPage.tsx)

**`ShiftTypeOverlayChip`:**
```tsx
function ShiftTypeOverlayChip({ shortName, bg, fg }: { shortName: string; bg: string; fg: string }) {
  return (
    <div style={{ background: bg, color: fg }}
      className="rounded-md px-2.5 py-1 text-xs font-bold shadow-lg pointer-events-none select-none">
      {shortName}
    </div>
  )
}
```

**`AbsenceOverlayChip`:**
```tsx
function AbsenceOverlayChip({ label }: { label: string }) {
  return (
    <div className="rounded-md px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 shadow-lg pointer-events-none select-none">
      {label}
    </div>
  )
}
```

### Reset
`handleDragEnd` / `handleDragCancel` → beide States auf `null`

---

## Implementierungs-Reihenfolge

1. **Feature 4** — Settings-Icon Höhe (kleinste Änderung, 1 Datei)
2. **Feature 1** — Arzt hinzufügen in Header (UnifiedPlanGrid, 1-2 Dateien)
3. **Feature 5** — Drag-Icon am Cursor (PlanPage DragOverlay-Erweiterung)
4. **Feature 2** — Drag-Spaltenhervorhebung (State + Datenfluss durch 3 Ebenen)
5. **Feature 3** — Popover am Cursor (Signatur-Änderung durch 3 Ebenen + DoctorAssignPopover)

## Betroffene Dateien

| Datei | Features |
|-------|----------|
| `PlanModeBar.tsx` | 4, 5 (ShiftTypeOverlayChip) |
| `UnifiedPlanGrid.tsx` | 1, 2 |
| `UnifiedShiftCell.tsx` | 2, 3 |
| `PlanPage.tsx` | 2, 3, 5 |
| `DoctorAssignPopover.tsx` | 3 |

## Tests

- **Feature 1:** Kein `AddRotationRow` mehr im DOM; `+`-Button in Header vorhanden
- **Feature 2:** `dragDimDays`-Berechnung unit-testbar (pure Set-Berechnung aus shifts-Array)
- **Feature 3:** Popover-Position bei `anchorPosition`-Prop geprüft
- **Feature 4:** Keine automatischen Tests nötig (rein visuell)
- **Feature 5:** Kein Render-Test nötig; DragOverlay-Logik durch bestehende DnD-Tests abgedeckt
