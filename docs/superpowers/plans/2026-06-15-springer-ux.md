# Springer UX Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Springer-Farbe konfigurierbar machen (Einstellungen), Springer-Option im Einzelzell-Popover anbieten, Springer in Mehrfachauswahl-Popover integrieren.

**Architecture:** Rein Frontend. `useAppSettings` (Zustand+persist) erhält `springerColor`. `UnifiedShiftCell` liest die Farbe dynamisch. `DoctorAssignPopover` und `ShiftBlockPopover` erhalten je einen neuen Abschnitt „Als Springer einteilen". PlanPage verdrahtet die Callbacks mit dem vorhandenen `createSpringerAssignment`/`deleteSpringerAssignment`-Hook.

**Tech Stack:** React 18, TypeScript strict, Zustand, TanStack Query, Vite, vitest + @testing-library/react, Tailwind CSS, shadcn/ui

---

## Dateien-Übersicht

| Datei | Änderung | Executor |
|---|---|---|
| `frontend/src/stores/useAppSettings.ts` | `springerColor` + `setSpringerColor` hinzufügen | **Codex** |
| `frontend/src/features/settings/SettingsPage.tsx` | Farbwähler-Zeile für Springer | **Codex** |
| `frontend/src/features/plans/components/UnifiedShiftCell.tsx` | Hardcoded Emerald → dynamisch aus Store | **Claude Code** |
| `frontend/src/features/plans/components/ShiftBlockPopover.tsx` | Springer-Abschnitt + Dept-Chips | **Codex** |
| `frontend/src/features/plans/PlanPage.tsx` | `handleMultiSpringerAssign` + Props ShiftBlockPopover + Props DoctorAssignPopover | **Codex** (multi) / **Claude Code** (single) |
| `frontend/src/features/plans/components/DoctorAssignPopover.tsx` | Springer-Abschnitt + neue Props | **Claude Code** |
| `frontend/src/features/plans/tests/ShiftBlockPopover.test.tsx` | Neue Datei — Tests für Springer-Sektion | **Codex** |

---

## Task 1: useAppSettings — springerColor hinzufügen

> **Executor: Codex** (mechanisches Muster, 1 Datei)

**Files:**
- Modify: `frontend/src/stores/useAppSettings.ts`

**Kontext:** Der Zustand-Store persistiert App-Settings im localStorage (`dp-app-settings`). Das Muster für `absenceColors` ist identisch — einfach replizieren.

Aktuelle Datei:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AbsenceType } from '@/lib/types'

export const DEFAULT_ABSENCE_COLORS: Record<AbsenceType, string> = {
  URLAUB:       '#BBF7D0',
  KRANKHEIT:    '#FCA5A5',
  FORTBILDUNG:  '#C4B5FD',
  ELTERNZEIT:   '#BAE6FD',
  MUTTERSCHUTZ: '#FBCFE8',
  SONSTIGES:    '#E5E7EB',
}

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
  absenceColors: Record<AbsenceType, string>
  setAbsenceColor: (type: AbsenceType, color: string) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      solverEnabled: true,
      setSolverEnabled: (solverEnabled) => set({ solverEnabled }),
      absenceColors: { ...DEFAULT_ABSENCE_COLORS },
      setAbsenceColor: (type, color) =>
        set((s) => ({ absenceColors: { ...s.absenceColors, [type]: color } })),
    }),
    { name: 'dp-app-settings' }
  )
)
```

- [ ] **Schritt 1: Datei ersetzen**

Ersetze `frontend/src/stores/useAppSettings.ts` vollständig:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AbsenceType } from '@/lib/types'

export const DEFAULT_ABSENCE_COLORS: Record<AbsenceType, string> = {
  URLAUB:       '#BBF7D0',
  KRANKHEIT:    '#FCA5A5',
  FORTBILDUNG:  '#C4B5FD',
  ELTERNZEIT:   '#BAE6FD',
  MUTTERSCHUTZ: '#FBCFE8',
  SONSTIGES:    '#E5E7EB',
}

export const DEFAULT_SPRINGER_COLOR = '#d1fae5'

interface AppSettings {
  devMode: boolean
  setDevMode: (devMode: boolean) => void
  solverEnabled: boolean
  setSolverEnabled: (v: boolean) => void
  absenceColors: Record<AbsenceType, string>
  setAbsenceColor: (type: AbsenceType, color: string) => void
  springerColor: string
  setSpringerColor: (color: string) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set) => ({
      devMode: false,
      setDevMode: (devMode) => set({ devMode }),
      solverEnabled: true,
      setSolverEnabled: (solverEnabled) => set({ solverEnabled }),
      absenceColors: { ...DEFAULT_ABSENCE_COLORS },
      setAbsenceColor: (type, color) =>
        set((s) => ({ absenceColors: { ...s.absenceColors, [type]: color } })),
      springerColor: DEFAULT_SPRINGER_COLOR,
      setSpringerColor: (springerColor) => set({ springerColor }),
    }),
    { name: 'dp-app-settings' }
  )
)
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: keine neuen Fehler (4 vorbestehende Fehler in DoctorDetailPage und shift-palette.ts sind ignorierbar).

- [ ] **Schritt 3: Committen**

```bash
git add frontend/src/stores/useAppSettings.ts
git commit -m "feat: add springerColor to useAppSettings with default #d1fae5"
```

---

## Task 2: SettingsPage — Springer-Farbwähler

> **Executor: Codex** (Boilerplate nach bestehendem Muster, 1 Datei)

**Files:**
- Modify: `frontend/src/features/settings/SettingsPage.tsx`

**Kontext:** Die SettingsPage hat bereits zwei Toggle-Zeilen (`devMode`, `solverEnabled`) in einer `rounded-2xl bg-card border border-line p-5`-Karte. Die neue Zeile kommt als dritte Zeile in dieselbe Karte. Das Layout ist `flex items-center justify-between py-3 border-t border-line`.

- [ ] **Schritt 1: Import ergänzen**

In `frontend/src/features/settings/SettingsPage.tsx` ergänze den `useAppSettings`-Destructure:

```tsx
// Vorher:
const { devMode, setDevMode, solverEnabled, setSolverEnabled } = useAppSettings()

// Nachher:
const { devMode, setDevMode, solverEnabled, setSolverEnabled, springerColor, setSpringerColor } = useAppSettings()
```

- [ ] **Schritt 2: Farbwähler-Zeile einfügen**

Füge nach der `solverEnabled`-Zeile (vor dem schließenden `</div>` der ersten Karte) ein:

```tsx
<div className="flex items-center justify-between py-3 border-t border-line">
  <div>
    <p className="text-sm font-medium text-ink">Springer-Farbe</p>
    <p className="text-xs text-ink-3 mt-0.5">Hintergrundfarbe der Springer-Zuweisung im Grid</p>
  </div>
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={springerColor}
      onChange={(e) => setSpringerColor(e.target.value)}
      className="w-8 h-8 rounded cursor-pointer border border-line"
      aria-label="Springer-Farbe"
    />
    <button
      onClick={() => setSpringerColor('#d1fae5')}
      className="text-xs text-ink-3 hover:text-ink transition"
    >
      Reset
    </button>
  </div>
</div>
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/features/settings/SettingsPage.tsx
git commit -m "feat: add Springer color picker to SettingsPage"
```

---

## Task 3: UnifiedShiftCell — dynamische Springer-Farbe

> **Executor: Claude Code** (braucht Kontext über bestehende IIFE-Logik und Split-Cell-Rendering)

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

**Kontext:** `UnifiedShiftCell` hat drei Stellen mit hardcodiertem Emerald:
1. Zeile 165: `bg` IIFE — Springer-only Background `'#d1fae5'`
2. Zeile 251: Split-Cell obere Hälfte — `bg-emerald-100 text-emerald-800`
3. Zeile 262: Springer-only Span — `text-emerald-800`

Die Farbe `springerColor` wird aus `useAppSettings()` gelesen. Textfarbe ist immer `text-ink` (dunkel, farb-unabhängig).

- [ ] **Schritt 1: Import und Store-Hook hinzufügen**

Füge nach den bestehenden Imports ein:
```tsx
import { useAppSettings } from '@/stores/useAppSettings'
```

Füge am Anfang der `UnifiedShiftCell`-Komponente (nach dem ersten `const`-Block) hinzu:
```tsx
const { springerColor } = useAppSettings()
```

- [ ] **Schritt 2: bg-IIFE anpassen**

Ersetze:
```tsx
// Nur Springer (kein regulärer Shift)
if (springerDeptShortName && !text) return '#d1fae5'  // emerald-100
```
Mit:
```tsx
// Nur Springer (kein regulärer Shift)
if (springerDeptShortName && !text) return springerColor
```

- [ ] **Schritt 3: Split-Cell obere Hälfte anpassen**

Ersetze:
```tsx
<div className="flex-1 flex items-center justify-center bg-emerald-100 text-emerald-800 text-[10px] font-bold leading-none">
  {springerDeptShortName}
</div>
```
Mit:
```tsx
<div
  className="flex-1 flex items-center justify-center text-[10px] font-bold leading-none text-ink"
  style={{ backgroundColor: springerColor }}
>
  {springerDeptShortName}
</div>
```

- [ ] **Schritt 4: Springer-only Span anpassen**

Ersetze:
```tsx
<span className="text-[11px] font-bold leading-none pointer-events-none select-none text-emerald-800">
  {springerDeptShortName}
</span>
```
Mit:
```tsx
<span className="text-[11px] font-bold leading-none pointer-events-none select-none text-ink">
  {springerDeptShortName}
</span>
```

- [ ] **Schritt 5: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Schritt 6: Committen**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat: use dynamic springerColor in UnifiedShiftCell (from useAppSettings)"
```

---

## Task 4: ShiftBlockPopover — Springer-Abschnitt

> **Executor: Codex** (1 Datei, vollständiger Code im Spec, kein Domänen-Kontext nötig)

**Files:**
- Modify: `frontend/src/features/plans/components/ShiftBlockPopover.tsx`
- Create: `frontend/src/features/plans/tests/ShiftBlockPopover.test.tsx`

**Kontext:** `ShiftBlockPopover` zeigt ShiftType-Chips für Bulk-Zuweisung. Es braucht einen neuen Abschnitt „Als Springer einteilen" mit Dept-Chips (nur `active: true`). `Department` importieren aus `@/lib/types`.

**Aktueller Stand `ShiftBlockPopover.tsx`:**
```tsx
import { useEffect, useRef } from 'react'
import type { ShiftType } from '@/lib/types'

interface ShiftBlockPopoverProps {
  selectedCount: number
  shiftTypes: ShiftType[]
  onSelectShiftType: (shiftTypeId: number) => void
  onRemoveAll: () => void
  onClose: () => void
}
// ... (90 Zeilen)
```

- [ ] **Schritt 1: Vitest-Test schreiben**

Erstelle `frontend/src/features/plans/tests/ShiftBlockPopover.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ShiftBlockPopover } from '../components/ShiftBlockPopover'
import type { Department } from '@/lib/types'

const mockDepts: Department[] = [
  { id: 1, name: 'Station A', short_name: 'STA', active: true, display_order: 1, color: null, blocks_ina_weekdays: false, blocks_ina_weekends: false },
  { id: 2, name: 'Station B', short_name: 'STB', active: true, display_order: 2, color: null, blocks_ina_weekdays: false, blocks_ina_weekends: false },
  { id: 3, name: 'Inaktiv',   short_name: 'INA', active: false, display_order: 3, color: null, blocks_ina_weekdays: false, blocks_ina_weekends: false },
]

describe('ShiftBlockPopover — Springer', () => {
  it('zeigt nur aktive Abteilungen als Springer-Chips', () => {
    render(
      <ShiftBlockPopover
        selectedCount={2}
        shiftTypes={[]}
        onSelectShiftType={vi.fn()}
        onRemoveAll={vi.fn()}
        onClose={vi.fn()}
        departments={mockDepts}
        onAssignSpringer={vi.fn()}
      />
    )
    expect(screen.getByText('STA')).toBeInTheDocument()
    expect(screen.getByText('STB')).toBeInTheDocument()
    expect(screen.queryByText('INA')).not.toBeInTheDocument()
  })

  it('ruft onAssignSpringer mit korrekter departmentId auf', () => {
    const onAssignSpringer = vi.fn()
    render(
      <ShiftBlockPopover
        selectedCount={2}
        shiftTypes={[]}
        onSelectShiftType={vi.fn()}
        onRemoveAll={vi.fn()}
        onClose={vi.fn()}
        departments={mockDepts}
        onAssignSpringer={onAssignSpringer}
      />
    )
    fireEvent.click(screen.getByText('STB'))
    expect(onAssignSpringer).toHaveBeenCalledWith(2)
  })
})
```

- [ ] **Schritt 2: Test ausführen (soll FAIL)**

```bash
cd frontend && pnpm vitest run src/features/plans/tests/ShiftBlockPopover.test.tsx
```

Erwartung: FAIL — `departments` prop existiert nicht yet.

- [ ] **Schritt 3: ShiftBlockPopover implementieren**

Ersetze `frontend/src/features/plans/components/ShiftBlockPopover.tsx` vollständig:

```tsx
import { useEffect, useRef } from 'react'
import type { Department, ShiftType } from '@/lib/types'

interface ShiftBlockPopoverProps {
  selectedCount: number
  shiftTypes: ShiftType[]
  onSelectShiftType: (shiftTypeId: number) => void
  onRemoveAll: () => void
  onClose: () => void
  departments: Department[]
  onAssignSpringer: (departmentId: number) => void
}

export function ShiftBlockPopover({
  selectedCount,
  shiftTypes,
  onSelectShiftType,
  onRemoveAll,
  onClose,
  departments,
  onAssignSpringer,
}: ShiftBlockPopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9) {
        const st = shiftTypes[digit - 1]
        if (st) onSelectShiftType(st.id)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, shiftTypes, onSelectShiftType])

  const activeDepts = departments.filter((d) => d.active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={cardRef}
        className="bg-card border border-line rounded-2xl shadow-lg w-72 p-4 space-y-3"
      >
        <div className="space-y-1.5">
          <p className="text-xs text-ink-3 font-medium">
            {selectedCount} {selectedCount === 1 ? 'Zelle' : 'Zellen'} — Schicht wählen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shiftTypes.map((st, i) => (
              <button
                key={st.id}
                onClick={() => onSelectShiftType(st.id)}
                title={i < 9 ? `Taste ${i + 1}` : undefined}
                className="relative px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
              >
                {i < 9 && (
                  <span className="absolute -top-1.5 -right-1 text-[8px] font-normal text-ink-3 leading-none bg-card border border-line rounded px-0.5">
                    {i + 1}
                  </span>
                )}
                {st.short_name}
              </button>
            ))}
          </div>
          {shiftTypes.length === 0 && (
            <p className="text-xs text-ink-3">Keine Schichttypen verfügbar.</p>
          )}
        </div>

        {activeDepts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium">Als Springer einteilen</p>
            <div className="flex flex-wrap gap-1.5">
              {activeDepts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onAssignSpringer(d.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
                >
                  {d.short_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onRemoveAll}
          className="w-full text-xs text-warn-ink hover:bg-warn-bg py-1 rounded-md transition"
        >
          Alle Zuweisungen entfernen
        </button>
        <button
          onClick={onClose}
          className="w-full text-xs text-ink-3 hover:text-ink py-1 transition"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 4: Test ausführen (soll PASS)**

```bash
cd frontend && pnpm vitest run src/features/plans/tests/ShiftBlockPopover.test.tsx
```

Erwartung: 2/2 PASS.

- [ ] **Schritt 5: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: TypeScript meldet jetzt Fehler in PlanPage (fehlende `departments`/`onAssignSpringer` Props) — das wird in Task 5 behoben.

- [ ] **Schritt 6: Committen**

```bash
git add frontend/src/features/plans/components/ShiftBlockPopover.tsx frontend/src/features/plans/tests/ShiftBlockPopover.test.tsx
git commit -m "feat: add Springer section to ShiftBlockPopover with dept chips"
```

---

## Task 5: PlanPage — Multi-Springer Handler + ShiftBlockPopover-Props

> **Executor: Codex** (mechanisch, vollständiger Code im Plan, kein Domänen-Kontext nötig)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

**Kontext:** PlanPage rendert `ShiftBlockPopover` bei Zeile ~1213:
```tsx
{multiPopoverOpen && selectedCells.length > 0 && (
  <ShiftBlockPopover
    selectedCount={selectedCells.length}
    shiftTypes={shiftTypes}
    onSelectShiftType={handleMultiAssign}
    onRemoveAll={handleMultiRemove}
    onClose={handleCloseMultiPopover}
  />
)}
```

`useDeleteSpringerAssignment` ist bereits importiert und verwendet. `useCreateSpringerAssignment` ist noch **nicht** importiert — muss ergänzt werden.

**Hook-Signatur (wichtig — camelCase):**
```ts
// useCreateSpringerAssignment().mutate() erwartet:
{ planId: number; shiftDate: string; doctorId: number; targetDepartmentId: number }
```

`departments` ist bereits als Variable vorhanden. `id` ist die `planId` (aus URL-Params, als `number`). `selectedCells` ist `SelectedCell[]` mit `{ rotationId, doctorId, dayKey }`.

- [ ] **Schritt 1: Import ergänzen**

Ändere die Import-Zeile in PlanPage (ca. Zeile 65):
```ts
// Vorher:
import { usePlanSpringerAssignments, useDeleteSpringerAssignment } from './useSpringerAssignments'

// Nachher:
import { usePlanSpringerAssignments, useCreateSpringerAssignment, useDeleteSpringerAssignment } from './useSpringerAssignments'
```

- [ ] **Schritt 2: Hook instanziieren**

Füge direkt nach den anderen Springer-Hooks (ca. nach `const deleteSpringerAssignment = ...`) ein:
```ts
const createSpringerAssignment = useCreateSpringerAssignment()
```

- [ ] **Schritt 3: handleMultiSpringerAssign hinzufügen**

Füge nach `handleMultiRemove` (ca. Zeile 614) ein:

```ts
function handleMultiSpringerAssign(departmentId: number) {
  for (const cell of selectedCells) {
    createSpringerAssignment.mutate({
      planId: id,
      shiftDate: cell.dayKey,
      doctorId: cell.doctorId,
      targetDepartmentId: departmentId,
    })
  }
  setSelectedCells([])
  setMultiPopoverOpen(false)
}
```

- [ ] **Schritt 2: ShiftBlockPopover-Props ergänzen**

Ersetze das bestehende `<ShiftBlockPopover .../>` (ca. Zeile 1213–1221):

```tsx
{multiPopoverOpen && selectedCells.length > 0 && (
  <ShiftBlockPopover
    selectedCount={selectedCells.length}
    shiftTypes={shiftTypes}
    onSelectShiftType={handleMultiAssign}
    onRemoveAll={handleMultiRemove}
    onClose={handleCloseMultiPopover}
    departments={departments}
    onAssignSpringer={handleMultiSpringerAssign}
  />
)}
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: keine neuen Fehler (vorbestehende 4 Fehler bleiben).

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat: wire handleMultiSpringerAssign and departments into ShiftBlockPopover"
```

---

## Task 6: DoctorAssignPopover — Springer-Abschnitt

> **Executor: Claude Code** (braucht Kontext über Springer-Types, bestehende Props, useAppSettings)

**Files:**
- Modify: `frontend/src/features/plans/components/DoctorAssignPopover.tsx`

**Kontext:** `DoctorAssignPopover` öffnet sich beim Klick auf eine einzelne Zelle. Es zeigt:
1. Offene Schichten zum Zuweisen
2. (Bei besetzter Zelle) Anderen Arzt zuweisen
3. (Bei besetzter Zelle) Zuweisung entfernen

Ein neuer Abschnitt „Als Springer einteilen" soll **nach dem Schicht-Block** eingefügt werden. Er zeigt Dept-Chips wenn keine Springer-Zuweisung existiert, oder die aktive Zuweisung mit Entfernen-Button wenn vorhanden.

`springerColor` wird direkt aus `useAppSettings()` gelesen — kein neues Prop nötig.

**Aktuelle Imports am Dateianfang:**
```tsx
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAssignShift } from '../useAssignShift'
import { useDoctors } from '@/features/doctors/useDoctors'
import { useAvailabilityForDate } from '../useAvailabilityForDate'
import type { ShiftWithDetails } from '@/lib/types'
```

**Aktuelles Interface:**
```ts
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

- [ ] **Schritt 1: Imports erweitern**

```tsx
import { useAppSettings } from '@/stores/useAppSettings'
import type { Department, ShiftWithDetails, SpringerAssignment } from '@/lib/types'
```

(Entferne `import type { ShiftWithDetails } from '@/lib/types'` — wird durch die erweiterte Zeile ersetzt.)

- [ ] **Schritt 2: Props-Interface erweitern**

```ts
interface Props {
  planId: number
  doctorId: number
  day: string
  currentShift: ShiftWithDetails | null
  openShiftsForDay: ShiftWithDetails[]
  anchorPosition?: { x: number; y: number }
  onClose: () => void
  departments: Department[]
  currentSpringerAssignment?: SpringerAssignment | null
  currentDepartmentId?: number
  onAssignSpringer: (departmentId: number) => void
  onRemoveSpringer: (assignmentId: number) => void
}
```

- [ ] **Schritt 3: Destrukturierung erweitern**

```tsx
export function DoctorAssignPopover({
  planId, doctorId, day, currentShift, openShiftsForDay, anchorPosition, onClose,
  departments, currentSpringerAssignment, currentDepartmentId,
  onAssignSpringer, onRemoveSpringer,
}: Props) {
```

- [ ] **Schritt 4: Store-Hook im Komponenten-Body ergänzen**

Direkt nach dem ersten `const`-Block (nach `const { mutate, isPending } = useAssignShift(planId)`):

```tsx
const { springerColor } = useAppSettings()
```

- [ ] **Schritt 5: Springer-Abschnitt in cardContent einfügen**

Füge **nach dem `{/* Offene Schichten */}`-Block** und **vor `{/* Anderen Arzt zuweisen */}`** ein:

```tsx
{/* Springer */}
<div className="space-y-1.5">
  <p className="text-xs text-ink-3 font-medium">Als Springer einteilen</p>
  {currentSpringerAssignment ? (
    <div className="flex items-center gap-2">
      <span
        className="px-2.5 py-1 rounded-full text-xs font-bold text-ink border border-line"
        style={{ backgroundColor: springerColor }}
      >
        {currentSpringerAssignment.target_department.short_name}
      </span>
      <button
        onClick={() => onRemoveSpringer(currentSpringerAssignment.id)}
        className="text-xs text-warn-ink hover:underline"
      >
        Entfernen
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {departments
        .filter((d) => d.active && d.id !== currentDepartmentId)
        .map((d) => (
          <button
            key={d.id}
            disabled={isPending}
            onClick={() => onAssignSpringer(d.id)}
            className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
          >
            {d.short_name}
          </button>
        ))}
    </div>
  )}
</div>
```

- [ ] **Schritt 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: TypeScript meldet Fehler in PlanPage (fehlende neue Props bei `<DoctorAssignPopover>`) — das wird in Task 7 behoben.

- [ ] **Schritt 7: Committen**

```bash
git add frontend/src/features/plans/components/DoctorAssignPopover.tsx
git commit -m "feat: add Springer section to DoctorAssignPopover"
```

---

## Task 7: PlanPage — DoctorAssignPopover Springer-Props verdrahten

> **Executor: Claude Code** (Multi-File-Koordination, activeCell-Kontext, springerByKey)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

**Kontext:** `DoctorAssignPopover` wird bei Zeile ~1186 gerendert:
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

`activeCell` hat den Typ `{ rotationId: number; doctorId: number; day: string; shiftId: number | null }`.

Folgende Variablen sind in PlanPage bereits vorhanden:
- `springerByKey: Map<string, SpringerAssignment>` — Key: `"${doctor_id}-${shift_date}"`
- `rotations: RotationAssignment[]` — jede hat `.id`, `.doctor_id`, `.department_id`
- `departments: Department[]`
- `createSpringerAssignment` (Hook-Mutation, bereits importiert)
- `deleteSpringerAssignment` (Hook-Mutation, bereits importiert)

- [ ] **Schritt 1: Springer-Kontext aus activeCell ableiten**

Füge direkt vor dem `{activeCell && (` JSX-Block die zwei Berechnungen ein:

```tsx
const activeCellSpringer = activeCell
  ? (springerByKey.get(`${activeCell.doctorId}-${activeCell.day}`) ?? null)
  : null
const activeCellDeptId = activeCell
  ? rotations.find((r) => r.id === activeCell.rotationId)?.department_id
  : undefined
```

- [ ] **Schritt 2: Neue Props an DoctorAssignPopover übergeben**

Ersetze das bestehende `<DoctorAssignPopover .../>`:

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
    departments={departments}
    currentSpringerAssignment={activeCellSpringer}
    currentDepartmentId={activeCellDeptId}
    onAssignSpringer={(deptId) => {
      if (!activeCell) return
      createSpringerAssignment.mutate(
        {
          planId: id,
          shiftDate: activeCell.day,
          doctorId: activeCell.doctorId,
          targetDepartmentId: deptId,
        },
        { onSuccess: () => { setActiveCell(null); setCellClickPosition(null) } },
      )
    }}
    onRemoveSpringer={(assignmentId) => {
      deleteSpringerAssignment.mutate(assignmentId, {
        onSuccess: () => { setActiveCell(null); setCellClickPosition(null) },
      })
    }}
  />
)}
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

Erwartung: keine neuen Fehler.

- [ ] **Schritt 4: Alle vitest-Tests laufen lassen**

```bash
cd frontend && pnpm vitest run
```

Erwartung: alle Tests grün.

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat: wire Springer props to DoctorAssignPopover in PlanPage"
```

---

## Abschluss-Checkliste

Nach Task 7:

- [ ] `pnpm tsc --noEmit` — keine neuen TypeScript-Fehler
- [ ] `pnpm vitest run` — alle Tests grün
- [ ] Dev-Server starten: `pnpm dev`
- [ ] Manuell testen:
  - Einstellungen → Springer-Farbe ändern → Grid aktualisiert sich live
  - Reset-Button → Farbe zurück auf Grün
  - Zelle klicken → Popover zeigt „Als Springer einteilen" mit Dept-Chips
  - Springer zuweisen → Popover schließt, Zelle zeigt Springer-Badge in konfigurierter Farbe
  - Springer-Badge doppelklicken → Springer-Zuweisung entfernt
  - Mehrere Zellen auswählen (Shift+Klick oder Drag) → „Dienst zuweisen" → Springer-Abschnitt sichtbar → Dept wählen → alle Zellen bekommen Springer
