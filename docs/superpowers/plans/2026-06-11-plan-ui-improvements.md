# Plan UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5 UI-Verbesserungen im Plan-Grid: Settings-Icon Höhe, Arzt-hinzufügen in Header, Drag-Overlay-Chips, Drag-Spaltenhervorhebung und Popover am Cursor.

**Architecture:** Rein frontend-seitig. Alle Änderungen in `frontend/src/features/plans/`. Kein Backend-Eingriff. Features sind unabhängig und können nacheinander committed werden.

**Tech Stack:** React 18, TypeScript strict, @dnd-kit/core, Tailwind CSS, Lucide React, vitest

---

## File Map

| Datei | Tasks |
|-------|-------|
| `frontend/src/features/plans/components/PlanModeBar.tsx` | Task 1 |
| `frontend/src/features/plans/components/BereichHeaderRow.tsx` | Task 2 |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | Task 2, 4 |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | Task 4, 5 |
| `frontend/src/features/plans/PlanPage.tsx` | Task 3, 4, 5 |
| `frontend/src/features/plans/components/DoctorAssignPopover.tsx` | Task 5 |
| `frontend/src/features/plans/dragUtils.ts` | Task 4 (neu) |
| `frontend/src/features/plans/dragUtils.test.ts` | Task 4 (neu) |
| `frontend/src/features/plans/components/BereichHeaderRow.test.tsx` | Task 2 (neu) |

---

## Task 1: Settings-Icon Höhe angleichen

**Files:**
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx:184-204`

### Problem
Settings-Button hat feste `h-[30px] w-[30px]`, während "Plan generieren" via `py-[7px]` höher ist. Keine Button-Group-Optik.

- [ ] **Step 1: Buttons zu Button-Group umbauen**

In `PlanModeBar.tsx` Zeilen 183–204 ersetzen:

```tsx
{/* Rechts: Plan generieren + Settings */}
<div className="flex items-center">
  {solverEnabled && (
    <button
      type="button"
      onClick={onSolve}
      disabled={isSolving}
      className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-l-[10px] rounded-r-none bg-dp-accent text-[#FFF8EF] text-[12.5px] font-semibold hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
    >
      <Zap className="size-3.5" />
      {isSolving ? 'Berechne…' : 'Plan generieren'}
    </button>
  )}
  <button
    type="button"
    onClick={onSettingsClick}
    aria-label="Plan-Einstellungen"
    className={cn(
      'inline-flex items-center justify-center px-2.5 py-[7px] bg-dp-accent text-[#FFF8EF] hover:bg-dp-accent-hover transition-colors',
      solverEnabled
        ? 'rounded-l-none rounded-r-[10px] border-l border-[#FFF8EF]/20'
        : 'rounded-[10px]',
    )}
  >
    <Settings className="size-3.5" />
  </button>
</div>
```

- [ ] **Step 2: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: keine neuen Fehler

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx
git commit -m "fix(plan): Settings-Icon Höhe = Plan-generieren-Button — Button-Group"
```

---

## Task 2: "Arzt hinzufügen" in Header-Zeile

**Files:**
- Modify: `frontend/src/features/plans/components/BereichHeaderRow.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Create: `frontend/src/features/plans/components/BereichHeaderRow.test.tsx`

### Strategie
`AddRotationRow` (eigene Grid-Zeile) entfernen. `BereichHeaderRow` bekommt `onAddRotation`-Prop. Der `+`-Button erscheint `opacity-0 group-hover:opacity-100` rechts im Label-Cell.

- [ ] **Step 1: Failing-Test schreiben**

Neue Datei `frontend/src/features/plans/components/BereichHeaderRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { BereichHeaderRow } from './BereichHeaderRow'
import type { Department } from '@/lib/types'

const mockDept: Department = {
  id: 1,
  name: 'Neurologie',
  short_name: 'Neuro',
  display_order: 1,
  blocks_ina_weekdays: false,
  blocks_ina_weekends: false,
  max_headcount: null,
  color: null,
  active: true,
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>
}

describe('BereichHeaderRow', () => {
  it('renders + button when onAddRotation provided', () => {
    render(
      <BereichHeaderRow department={mockDept} onAddRotation={vi.fn()} />,
      { wrapper: Wrapper },
    )
    expect(screen.getByRole('button', { name: 'Arzt hinzufügen' })).toBeTruthy()
  })

  it('calls onAddRotation when + button is clicked', async () => {
    const onAdd = vi.fn()
    render(
      <BereichHeaderRow department={mockDept} onAddRotation={onAdd} />,
      { wrapper: Wrapper },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Arzt hinzufügen' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('does not render + button without onAddRotation', () => {
    render(<BereichHeaderRow department={mockDept} />, { wrapper: Wrapper })
    expect(screen.queryByRole('button', { name: 'Arzt hinzufügen' })).toBeNull()
  })
})
```

- [ ] **Step 2: Test scheitert bestätigen**

```bash
cd frontend && pnpm vitest run src/features/plans/components/BereichHeaderRow.test.tsx
```
Expected: FAIL — "Arzt hinzufügen"-Button nicht gefunden

- [ ] **Step 3: BereichHeaderRow.tsx — `Plus` importieren + Props erweitern**

Import ergänzen (Zeile 1):
```tsx
import { Plus } from 'lucide-react'
```

Props-Interface (Zeile 32–36) ersetzen:
```tsx
interface BereichHeaderRowProps {
  department: Department
  rotationCount?: number
  onDepartmentClick?: (departmentId: number) => void
  onAddRotation?: () => void
}
```

Funktionssignatur (Zeile 38) ersetzen:
```tsx
export function BereichHeaderRow({ department, rotationCount, onDepartmentClick, onAddRotation }: BereichHeaderRowProps) {
```

- [ ] **Step 4: `+`-Button in Label-Cell einfügen**

Den Label-Cell-`div` (Zeile 51–68) ersetzen:

```tsx
{/* Label-Cell: sticky, Drop-Target, group für Hover-Button */}
<div
  ref={setNodeRef}
  className="group sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-line"
  onClick={() => onDepartmentClick?.(department.id)}
  style={{
    borderLeft: `4px solid ${color}`,
    backgroundColor: bg,
    cursor: onDepartmentClick ? 'pointer' : undefined,
  }}
>
  <span className="text-xs font-semibold text-ink truncate leading-none flex-1">
    {department.short_name ?? department.name}
  </span>
  {typeof rotationCount === 'number' && department.max_headcount != null && (
    <span className="text-[10px] text-ink-3 shrink-0 tabular-nums leading-none">
      {rotationCount}/{department.max_headcount}
    </span>
  )}
  {onAddRotation && (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAddRotation() }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10 shrink-0"
      aria-label="Arzt hinzufügen"
      title="Arzt hinzufügen"
    >
      <Plus className="size-3 text-ink" />
    </button>
  )}
</div>
```

- [ ] **Step 5: Test besteht**

```bash
cd frontend && pnpm vitest run src/features/plans/components/BereichHeaderRow.test.tsx
```
Expected: PASS (3 Tests grün)

- [ ] **Step 6: UnifiedPlanGrid.tsx — `AddRotationRow` entfernen und Header verdrahten**

**6a** — `AddRotationRow`-Funktion (Zeilen 49–67) vollständig löschen.

**6b** — Header-Render (Zeilen 366–378) `onAddRotation` übergeben:
```tsx
if (row.kind === 'header') {
  const rotationCount = rows.filter(
    (r) => r.kind === 'rotation' && r.department.id === row.department.id,
  ).length
  return [
    <BereichHeaderRow
      key={row.rowKey}
      department={row.department}
      rotationCount={rotationCount}
      onDepartmentClick={onDepartmentClick}
      onAddRotation={onAddRotation ? () => onAddRotation(row.department.id) : undefined}
    />,
  ]
}
```

**6c** — Placeholder-Fall (Zeilen 380–401): den `if (onAddRotation)` Branch mit `AddRotationRow` entfernen. Nur noch:
```tsx
if (row.kind === 'placeholder') {
  const color = getDepartmentColor(row.department)
  return [
    <div key={row.rowKey} className="contents">
      <PlaceholderLabelCell department={row.department} />
      {dayKeys.map((dk) => (
        <div
          key={dk}
          className="border-b border-r border-line"
          style={{ backgroundColor: `${color}10` }}
        />
      ))}
    </div>,
  ]
}
```

**6d** — Trailing `AddRotationRow` nach letzter Rotation (Zeilen 518–534) entfernen:
```tsx
// Vorher:
return [
  rotationEl,
  ...(onAddRotation && isLastInDept
    ? [<AddRotationRow key={`add-dept-${row.department.id}`} onAdd={() => onAddRotation(row.department.id)} />]
    : []),
]

// Nachher:
return [rotationEl]
```

Auch die `isLastInDept`-Berechnung (Zeilen 518–523) kann entfernt werden, da sie nur für `AddRotationRow` gebraucht wurde.

- [ ] **Step 7: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: keine neuen Fehler

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/components/BereichHeaderRow.tsx \
        frontend/src/features/plans/components/BereichHeaderRow.test.tsx \
        frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(plan): Arzt-hinzufügen-Button in Bereichs-Header (hover-sichtbar)"
```

---

## Task 3: Drag-Overlay-Chips (Dienst + Abwesenheit)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

### Strategie
`DragOverlay` hat bisher nur `DoctorDragOverlayToken`. Zwei neue Inline-Komponenten für ShiftType- und Absence-Drags. Beide States werden in `handleDragStart` gesetzt und in `handleDragEnd/Cancel` gecleart.

- [ ] **Step 1: `colorForShiftType`-Import zu PlanPage.tsx hinzufügen**

In `PlanPage.tsx` nach den bestehenden Importen (nach Zeile 83) einfügen:
```tsx
import { colorForShiftType } from '@/lib/design/shift-palette'
```

- [ ] **Step 2: Zwei neue States nach `activeDragDoctor` (nach Zeile 136) einfügen**

```tsx
const [activeDragShiftType, setActiveDragShiftType] = useState<{
  id: number
  shortName: string
  bg: string
  fg: string
} | null>(null)
const [activeDragAbsence, setActiveDragAbsence] = useState<{ label: string } | null>(null)
```

- [ ] **Step 3: `handleDragStart` erweitern**

Im `if (shiftTypeId !== null)`-Block (nach `setDragConflictMap(map)` auf Zeile 625) vor dem Ende des Blocks einfügen:
```tsx
const st = shiftTypes.find((s) => s.id === shiftTypeId)
if (st) {
  const pal = colorForShiftType({ id: st.id, code: st.short_name })
  setActiveDragShiftType({ id: st.id, shortName: st.short_name, bg: pal.bg, fg: pal.fg })
}
return
```

Nach dem gesamten `if (shiftTypeId !== null)` Block (nach Zeile 626) hinzufügen:
```tsx
const absenceType = parseAbsenceDragId(activeId)
if (absenceType !== null) {
  setActiveDragAbsence({ label: ABSENCE_TYPE_LABELS[absenceType] })
}
```

- [ ] **Step 4: `handleDragEnd` und `handleDragCancel` erweitern**

`handleDragEnd` (Zeilen 629–631), nach dem bestehenden Reset:
```tsx
function handleDragEnd(event: DragEndEvent) {
  setActiveDragDoctor(null)
  setDragConflictMap(null)
  setActiveDragShiftType(null)
  setActiveDragAbsence(null)
  // ... rest unverändert
```

`handleDragCancel` (Zeilen 755–758):
```tsx
function handleDragCancel() {
  setActiveDragDoctor(null)
  setDragConflictMap(null)
  setActiveDragShiftType(null)
  setActiveDragAbsence(null)
}
```

- [ ] **Step 5: `DragOverlay` erweitern (Zeilen 1052–1060)**

```tsx
<DragOverlay modifiers={[avatarTopModifier]}>
  {activeDragDoctor && (
    <DoctorDragOverlayToken
      name={activeDragDoctor.name}
      shortName={activeDragDoctor.shortName}
      id={activeDragDoctor.id}
    />
  )}
  {activeDragShiftType && (
    <ShiftTypeOverlayChip
      shortName={activeDragShiftType.shortName}
      bg={activeDragShiftType.bg}
      fg={activeDragShiftType.fg}
    />
  )}
  {activeDragAbsence && (
    <AbsenceOverlayChip label={activeDragAbsence.label} />
  )}
</DragOverlay>
```

- [ ] **Step 6: Zwei Overlay-Komponenten am Ende von PlanPage.tsx vor der letzten schließenden Klammer einfügen**

```tsx
function ShiftTypeOverlayChip({ shortName, bg, fg }: { shortName: string; bg: string; fg: string }) {
  return (
    <div
      style={{ background: bg, color: fg }}
      className="rounded-md px-2.5 py-1 text-xs font-bold shadow-lg pointer-events-none select-none"
    >
      {shortName}
    </div>
  )
}

function AbsenceOverlayChip({ label }: { label: string }) {
  return (
    <div className="rounded-md px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 shadow-lg pointer-events-none select-none">
      {label}
    </div>
  )
}
```

- [ ] **Step 7: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: keine neuen Fehler

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plan): Drag-Overlay-Chip für Dienst- und Abwesenheits-Drag"
```

---

## Task 4: Drag-Spaltenhervorhebung

**Files:**
- Create: `frontend/src/features/plans/dragUtils.ts`
- Create: `frontend/src/features/plans/dragUtils.test.ts`
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

### Strategie
`dragDimDays: Set<string>` — Tage wo der gezogene Dienst schon vergeben ist. Diese Spalten/Zellen dimmen. Alle anderen Zellen bekommen Emerald-Highlight.

- [ ] **Step 1: Failing-Test für `computeDragDimDays` schreiben**

Neue Datei `frontend/src/features/plans/dragUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeDragDimDays } from './dragUtils'
import type { ShiftWithDetails } from '@/lib/types'

function makeShift(shiftTypeId: number, shiftDate: string, doctorId: number | null): ShiftWithDetails {
  return {
    id: Math.random(),
    plan_id: 1,
    shift_type_id: shiftTypeId,
    shift_date: shiftDate,
    doctor_id: doctorId,
    is_pinned: false,
    is_locked: false,
    note: null,
    shift_type: null,
    conflicts: [],
  } as unknown as ShiftWithDetails
}

describe('computeDragDimDays', () => {
  it('returns days where the shift type has an assigned doctor', () => {
    const shifts = [
      makeShift(1, '2026-06-01', 5),
      makeShift(1, '2026-06-02', null),
      makeShift(2, '2026-06-01', 7),
    ]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set(['2026-06-01']))
  })

  it('returns empty set when no assignments for shift type', () => {
    const shifts = [makeShift(1, '2026-06-01', null)]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set())
  })

  it('collects multiple assigned days', () => {
    const shifts = [
      makeShift(1, '2026-06-01', 5),
      makeShift(1, '2026-06-03', 9),
    ]
    expect(computeDragDimDays(shifts, 1)).toEqual(new Set(['2026-06-01', '2026-06-03']))
  })
})
```

- [ ] **Step 2: Test scheitert bestätigen**

```bash
cd frontend && pnpm vitest run src/features/plans/dragUtils.test.ts
```
Expected: FAIL — Modul nicht gefunden

- [ ] **Step 3: `dragUtils.ts` implementieren**

Neue Datei `frontend/src/features/plans/dragUtils.ts`:

```ts
import type { ShiftWithDetails } from '@/lib/types'

export function computeDragDimDays(shifts: ShiftWithDetails[], shiftTypeId: number): Set<string> {
  const days = new Set<string>()
  for (const shift of shifts) {
    if (shift.shift_type_id === shiftTypeId && shift.doctor_id != null) {
      days.add(shift.shift_date)
    }
  }
  return days
}
```

- [ ] **Step 4: Test besteht**

```bash
cd frontend && pnpm vitest run src/features/plans/dragUtils.test.ts
```
Expected: PASS (3 Tests grün)

- [ ] **Step 5: `dragDimDays` useMemo in PlanPage.tsx einfügen**

Import hinzufügen (nach bestehenden imports):
```tsx
import { computeDragDimDays } from './dragUtils'
```

Nach dem `selectedCellKeys`-useMemo (nach Zeile 262) einfügen:
```tsx
const dragDimDays = useMemo(
  () => activeDragShiftType ? computeDragDimDays(shifts, activeDragShiftType.id) : undefined,
  [activeDragShiftType, shifts],
)
```

- [ ] **Step 6: `dragDimDays` an UnifiedPlanGrid übergeben**

In der `<UnifiedPlanGrid>`-Komponente (nach dem bestehenden `dragConflictMap`-Prop, ca. Zeile 888) hinzufügen:
```tsx
dragDimDays={dragDimDays}
```

- [ ] **Step 7: `UnifiedPlanGridProps` und Spaltenheader in UnifiedPlanGrid.tsx erweitern**

Props-Interface (nach Zeile 29 `dragConflictMap`) ergänzen:
```tsx
dragDimDays?: Set<string>
```

Destrukturierung in `UnifiedPlanGrid` (nach `dragConflictMap`) ergänzen:
```tsx
dragDimDays,
```

Spaltenheader-`div` (Zeilen 340–361): `dragDimDays`-Dimming hinzufügen:
```tsx
className={cn(
  'sticky top-0 z-10 border-b border-r border-line text-center py-[7px] px-0.5 transition-colors',
  dragDimDays?.has(dk) && 'opacity-40',
  tod ? 'bg-warn-bg' : we ? 'bg-weekend' : effectiveHoverDay === dk ? 'bg-paper/80' : 'bg-[#FAF5E9]',
)}
```

- [ ] **Step 8: `isDragDimmed` + `isDragHighlighted` an UnifiedShiftCell übergeben**

In der `<UnifiedShiftCell>`-Render-Schleife (nach dem bestehenden `isHighlightedRow`-Prop, ca. Zeile 472) hinzufügen:
```tsx
isDragDimmed={dragDimDays !== undefined && dragDimDays.has(dk)}
isDragHighlighted={dragDimDays !== undefined && !dragDimDays.has(dk)}
```

- [ ] **Step 9: `UnifiedShiftCell.tsx` Props + visuelle Behandlung**

Props-Interface (nach `isHighlightedRow?: boolean`, Zeile 33) ergänzen:
```tsx
isDragDimmed?: boolean
isDragHighlighted?: boolean
```

Destrukturierung ergänzen:
```tsx
isDragDimmed,
isDragHighlighted,
```

Im `cn(...)` des Haupt-`div` (Zeile 140–149) ergänzen:
```tsx
isDragDimmed && 'opacity-30 grayscale',
isDragHighlighted && 'ring-1 ring-inset ring-emerald-400/60',
```

Highlight-Overlay nach dem Selected-Overlay (nach Zeile 187) einfügen:
```tsx
{/* Drag-Highlight-Tint: Spalten ohne diesen Dienst */}
{isDragHighlighted && (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{ backgroundColor: 'rgba(52, 211, 153, 0.07)' }}
  />
)}
```

- [ ] **Step 10: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: keine neuen Fehler

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/plans/dragUtils.ts \
        frontend/src/features/plans/dragUtils.test.ts \
        frontend/src/features/plans/PlanPage.tsx \
        frontend/src/features/plans/components/UnifiedPlanGrid.tsx \
        frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat(plan): Drag-Spaltenhervorhebung — dim/highlight beim Dienst-Drag"
```

---

## Task 5: Popover am Cursor

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`
- Modify: `frontend/src/features/plans/components/DoctorAssignPopover.tsx`

### Strategie
`onClick` in UnifiedShiftCell gibt Klick-Koordinaten mit. PlanPage speichert sie als `cellClickPosition`. DoctorAssignPopover rendert `fixed` an dieser Position statt zentriert.

- [ ] **Step 1: `onClick`-Signatur in UnifiedShiftCell.tsx ändern**

Zeile 38 in `UnifiedShiftCellProps`:
```tsx
// Vorher:
onClick?: (shiftKey: boolean) => void
// Nachher:
onClick?: (shiftKey: boolean, clickPos: { x: number; y: number }) => void
```

`handleClick`-Funktion (Zeilen 89–105) anpassen — Koordinaten vor dem Timeout extrahieren:
```tsx
function handleClick(e: React.MouseEvent) {
  if (isLocked) return
  const { shiftKey } = e
  const clickPos = { x: e.clientX, y: e.clientY }
  const needsDoubleClickDelay =
    (onDoubleClickRemove && shiftAssigned) ||
    (onDoubleClickRemoveAbsence && absenceId !== undefined)

  if (needsDoubleClickDelay) {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    clickTimerRef.current = setTimeout(() => { onClick?.(shiftKey, clickPos) }, 300)
  } else {
    onClick?.(shiftKey, clickPos)
  }
}
```

- [ ] **Step 2: `onCellClick`-Signatur in UnifiedPlanGrid.tsx erweitern**

Props-Interface (Zeile 32):
```tsx
// Vorher:
onCellClick?: (rotationId: number, doctorId: number, dayKey: string, shiftId: number | null, shiftKey: boolean) => void
// Nachher:
onCellClick?: (rotationId: number, doctorId: number, dayKey: string, shiftId: number | null, shiftKey: boolean, clickPos: { x: number; y: number }) => void
```

`onClick`-Handler in der Render-Schleife (Zeilen 488–494):
```tsx
onClick={(shiftKey, clickPos) => {
  if (dragSelectFiredRef.current) {
    dragSelectFiredRef.current = false
    return
  }
  onCellClick?.(row.rotation.id, row.doctor.id, dk, shift?.id ?? null, shiftKey, clickPos)
}}
```

- [ ] **Step 3: `handleCellClick` und State in PlanPage.tsx**

Neuen State nach `activeCell` (nach Zeile 124) hinzufügen:
```tsx
const [cellClickPosition, setCellClickPosition] = useState<{ x: number; y: number } | null>(null)
```

`handleCellClick`-Signatur (Zeilen 463–469) erweitern:
```tsx
function handleCellClick(
  rotationId: number,
  doctorId: number,
  day: string,
  shiftId: number | null,
  shiftKey: boolean,
  clickPos: { x: number; y: number },
) {
```

Am Ende des non-shiftKey Pfades in `handleCellClick` (nach Zeile 488):
```tsx
setContextShift(null)
setSelectedDepartmentId(null)
setActiveCell({ rotationId, doctorId, day, shiftId })
setCellClickPosition(clickPos)   // neu
setSelectedDoctorId(doctorId)
setSidebarTab('details')
```

`DoctorAssignPopover`-Render (Zeilen 997–1010) anpassen:
```tsx
{activeCell && (
  <DoctorAssignPopover
    planId={id}
    doctorId={activeCell.doctorId}
    day={activeCell.day}
    currentShift={shifts.find((s) => s.id === activeCell.shiftId) ?? null}
    openShiftsForDay={shifts.filter(
      (s) =>
        s.shift_date === activeCell.day &&
        (s.doctor_id === null || s.doctor_id === undefined),
    )}
    anchorPosition={cellClickPosition ?? undefined}
    onClose={() => { setActiveCell(null); setCellClickPosition(null) }}
  />
)}
```

- [ ] **Step 4: `DoctorAssignPopover.tsx` — `anchorPosition`-Prop + bedingtes Positioning**

Props-Interface (Zeilen 10–17) erweitern:
```tsx
interface Props {
  planId: number
  doctorId: number
  day: string
  currentShift: ShiftWithDetails | null
  openShiftsForDay: ShiftWithDetails[]
  anchorPosition?: { x: number; y: number }
  onClose: () => void
}
```

Funktionssignatur (Zeile 19) erweitern:
```tsx
export function DoctorAssignPopover({
  planId, doctorId, day, currentShift, openShiftsForDay, anchorPosition, onClose,
}: Props) {
```

Den Return-Block (Zeilen 72–161) umbauen — Inhalt in Variable auslagern:

```tsx
const cardContent = (
  <>
    {/* Offene Schichten */}
    {openShiftsForDay.length > 0 && (
      <div className="space-y-1.5">
        <p className="text-xs text-ink-3 font-medium">Schicht auswählen</p>
        <div className="flex flex-wrap gap-1.5">
          {openShiftsForDay.map((s, idx) => (
            <button
              key={s.id}
              disabled={isPending}
              onClick={() => assign(s.id, doctorId)}
              title={idx < 9 ? `Taste ${idx + 1}` : undefined}
              className="relative px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
            >
              {idx < 9 && (
                <span className="absolute -top-1.5 -right-1 text-[8px] font-normal text-ink-3 leading-none bg-card border border-line rounded px-0.5">
                  {idx + 1}
                </span>
              )}
              {s.shift_type?.short_name ?? s.shift_type_id}
            </button>
          ))}
        </div>
      </div>
    )}

    {currentShift && (
      <div className="space-y-1.5">
        <p className="text-xs text-ink-3 font-medium">Anderen Arzt zuweisen</p>
        <Input
          placeholder="Suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
        <ul className="max-h-40 overflow-y-auto space-y-0.5">
          {filteredDoctors.map((d) => {
            const avail = availabilityMap[d.id]
            const unavailable = avail !== undefined && !avail.available
            const tooltip = unavailable ? avail.reasons.join(', ') : undefined
            return (
              <li key={d.id}>
                <button
                  disabled={isPending}
                  onClick={() => assign(currentShift.id, d.id)}
                  title={tooltip}
                  className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-paper transition flex items-center gap-1.5"
                >
                  {unavailable && (
                    <span
                      aria-label="Nicht INA-verfügbar"
                      className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                    />
                  )}
                  <span>{d.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )}

    {currentShift && (
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-warn-ink hover:bg-warn-bg text-xs"
        disabled={isPending}
        onClick={() => assign(currentShift.id, null)}
      >
        Zuweisung entfernen
      </Button>
    )}

    {openShiftsForDay.length === 0 && !currentShift && (
      <p className="text-xs text-ink-3">Keine offenen Schichten an diesem Tag.</p>
    )}
  </>
)

const cardClass = 'bg-card border border-line rounded-2xl shadow-lg w-72 p-4 space-y-3'

if (anchorPosition) {
  return (
    <div
      ref={cardRef}
      className={`fixed z-50 ${cardClass}`}
      style={{
        left: Math.min(anchorPosition.x, window.innerWidth - 296),
        top: anchorPosition.y + 8,
      }}
    >
      {cardContent}
    </div>
  )
}

return (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div ref={cardRef} className={cardClass}>
      {cardContent}
    </div>
  </div>
)
```

- [ ] **Step 5: TypeScript-Check**

```bash
cd frontend && pnpm tsc --noEmit
```
Expected: keine neuen Fehler

- [ ] **Step 6: Alle Tests laufen lassen**

```bash
cd frontend && pnpm vitest run
```
Expected: alle Tests grün, keine Regressionen

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx \
        frontend/src/features/plans/components/UnifiedPlanGrid.tsx \
        frontend/src/features/plans/PlanPage.tsx \
        frontend/src/features/plans/components/DoctorAssignPopover.tsx
git commit -m "feat(plan): DoctorAssignPopover öffnet am Klick-Cursor (8px Offset)"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] Feature 4 (Settings-Icon) → Task 1
- [x] Feature 1 (Arzt-hinzufügen in Header) → Task 2
- [x] Feature 5 (Drag-Overlay-Chip) → Task 3
- [x] Feature 2 (Drag-Spaltenhervorhebung) → Task 4
- [x] Feature 3 (Popover am Cursor) → Task 5

### Typ-Konsistenz
- `activeDragShiftType` hat `id: number` — in Task 3 und Task 4 konsistent
- `computeDragDimDays(shifts, shiftTypeId)` — in Task 4 importiert und in PlanPage genutzt
- `onClick?: (shiftKey: boolean, clickPos: { x: number; y: number }) => void` — in UnifiedShiftCell (Task 5 Step 1) und UnifiedPlanGrid (Task 5 Step 2) konsistent
- `onCellClick` in UnifiedPlanGrid und `handleCellClick` in PlanPage — beide um `clickPos` erweitert (Task 5 Steps 2+3)
- `anchorPosition?: { x: number; y: number }` — in Props und Render von DoctorAssignPopover (Task 5 Step 4)

### Keine Placeholder
- Alle Steps enthalten vollständigen Code
- Keine "ähnlich wie Task N"-Referenzen
