# Abwesenheits-DnD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abwesenheitstypen per Drag & Drop in den Schichtplan eintragen — Drop öffnet Zeitraum-Popover, speichert via Absence-API, löschen per Doppelklick.

**Architecture:** Neues `AbsenceTypeDragBar`-Komponente rechts neben `ShiftTypeDragBar`. Drag-ID-Prefix `absence-{TYPE}` (analog zu `shift-{id}`). Drop landet in `handleDragEnd` in `PlanPage`, öffnet `AbsenceAssignPopover`. Doppelklick auf Absence-Zelle via neuem `useDeleteAbsence`-Hook.

**Tech Stack:** React 18, TypeScript, dnd-kit, TanStack Query, shadcn/ui, Tailwind CSS, FastAPI (Backend — keine Änderungen nötig)

---

## File Map

| Datei | Typ | Inhalt |
|---|---|---|
| `components/AbsenceTypeDragBar.tsx` | Neu | 6 draggbare Absence-Chips + ID-Helpers |
| `components/AbsenceAssignPopover.tsx` | Neu | Zeitraum-Dialog nach Drop, POST-Mutation |
| `useDeleteAbsence.ts` | Neu | DELETE-Hook mit Cache-Invalidierung |
| `unifiedGridUtils.ts` | Änderung | FORTBILDUNG → 'FB' |
| `components/UnifiedShiftCell.tsx` | Änderung | absenceId-Prop + Doppelklick-Delete |
| `components/UnifiedPlanGrid.tsx` | Änderung | absenceId durchschleifen + Callback |
| `components/ShiftTypeDragBar.tsx` | Änderung | "Alle Dienste"-Button rein |
| `PlanPage.tsx` | Änderung | Alles verdrahten |

---

## Task 1: FORTBILDUNG-Kürzel überall auf "FB" ändern

**Files:**
- Modify: `frontend/src/features/plans/unifiedGridUtils.ts:72`
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx:100`

- [ ] **Schritt 1: unifiedGridUtils.ts — ABSENCE_CODES ändern**

```typescript
// frontend/src/features/plans/unifiedGridUtils.ts — Zeile 72
const ABSENCE_CODES: Record<AbsenceType, string> = {
  URLAUB: 'U',
  KRANKHEIT: 'K',
  FORTBILDUNG: 'FB',      // war: 'Fo'
  ELTERNZEIT: 'EZ',
  MUTTERSCHUTZ: 'MuSchu',
  SONSTIGES: 'EA',
}
```

- [ ] **Schritt 2: UnifiedShiftCell.tsx — isAbsenceCode-Array aktualisieren**

```typescript
// frontend/src/features/plans/components/UnifiedShiftCell.tsx — Zeile 100
const isAbsenceCode = ['U', 'K', 'FB', 'EZ', 'MuSchu', 'EA'].includes(text)
//                          ^^^^ war: 'Fo'
```

- [ ] **Schritt 3: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/features/plans/unifiedGridUtils.ts \
        frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "fix: Fortbildung-Kürzel FB statt Fo (überall konsistent)"
```

---

## Task 2: AbsenceTypeDragBar — neue Komponente

**Files:**
- Create: `frontend/src/features/plans/components/AbsenceTypeDragBar.tsx`

- [ ] **Schritt 1: Datei erstellen**

```typescript
// frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { AbsenceType } from '@/lib/types'

export const ABSENCE_DRAG_ID_PREFIX = 'absence-'

export function makeAbsenceDragId(type: AbsenceType): string {
  return `${ABSENCE_DRAG_ID_PREFIX}${type}`
}

const VALID_ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
]

export function parseAbsenceDragId(id: string): AbsenceType | null {
  if (!id.startsWith(ABSENCE_DRAG_ID_PREFIX)) return null
  const type = id.slice(ABSENCE_DRAG_ID_PREFIX.length) as AbsenceType
  return VALID_ABSENCE_TYPES.includes(type) ? type : null
}

const ABSENCE_CHIP_META: Record<AbsenceType, { short: string; full: string }> = {
  URLAUB:       { short: 'U',      full: 'Urlaub' },
  KRANKHEIT:    { short: 'K',      full: 'Krankheit' },
  FORTBILDUNG:  { short: 'FB',     full: 'Fortbildung' },
  ELTERNZEIT:   { short: 'EZ',     full: 'Elternzeit' },
  MUTTERSCHUTZ: { short: 'MuSchu', full: 'Mutterschutz' },
  SONSTIGES:    { short: 'EA',     full: 'Sonstiges' },
}

export function AbsenceTypeDragBar() {
  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card"
      aria-label="Abwesenheits-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
        Abwesenheiten
      </span>
      {VALID_ABSENCE_TYPES.map((type) => (
        <AbsenceTypeChip key={type} absenceType={type} />
      ))}
    </div>
  )
}

function AbsenceTypeChip({ absenceType }: { absenceType: AbsenceType }) {
  const { short, full } = ABSENCE_CHIP_META[absenceType]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeAbsenceDragId(absenceType),
    data: { absenceType },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'px-2.5 py-1 rounded-md border border-[#d4c8b4] text-[11px] font-semibold cursor-grab select-none',
        'bg-[#FFF8F0] text-[#7a5c3a] hover:bg-[#FFF0E0] active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
      )}
      title={full}
    >
      {short}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
git commit -m "feat(plans): AbsenceTypeDragBar — 6 draggbare Abwesenheits-Chips"
```

---

## Task 3: useDeleteAbsence — neuer Hook

**Files:**
- Create: `frontend/src/features/plans/useDeleteAbsence.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
// frontend/src/features/plans/useDeleteAbsence.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiDelete } from '@/lib/api'
import { planAbsenceKeys } from './usePlanAbsences'

export function useDeleteAbsence(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (absenceId: number) => apiDelete(`/api/absences/${absenceId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      // Invalidiert alle Availability-Queries (Absence ist INA-Quelle)
      qc.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/features/plans/useDeleteAbsence.ts
git commit -m "feat(plans): useDeleteAbsence — DELETE /api/absences/{id} mit Cache-Invalidierung"
```

---

## Task 4: AbsenceAssignPopover — neue Komponente

**Files:**
- Create: `frontend/src/features/plans/components/AbsenceAssignPopover.tsx`

- [ ] **Schritt 1: Datei erstellen**

```typescript
// frontend/src/features/plans/components/AbsenceAssignPopover.tsx
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { apiPost } from '@/lib/api'
import { planAbsenceKeys } from '../usePlanAbsences'
import type { AbsenceType, Absence } from '@/lib/types'

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  URLAUB:       'U — Urlaub',
  KRANKHEIT:    'K — Krankheit',
  FORTBILDUNG:  'FB — Fortbildung',
  ELTERNZEIT:   'EZ — Elternzeit',
  MUTTERSCHUTZ: 'MuSchu — Mutterschutz',
  SONSTIGES:    'EA — Sonstiges',
}

interface AbsenceAssignPopoverProps {
  doctorId: number
  doctorName: string
  absenceType: AbsenceType
  defaultFrom: string  // ISO date 'yyyy-MM-dd'
  planId: number
  onClose: () => void
}

export function AbsenceAssignPopover({
  doctorId,
  doctorName,
  absenceType,
  defaultFrom,
  planId,
  onClose,
}: AbsenceAssignPopoverProps) {
  const [validFrom, setValidFrom] = useState(defaultFrom)
  const [validTo, setValidTo] = useState('')
  const [notes, setNotes] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: { doctor_id: number; absence_type: AbsenceType; valid_from: string; valid_to: string; notes?: string }) =>
      apiPost<Absence>(`/api/doctors/${doctorId}/absences`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      qc.invalidateQueries({ queryKey: ['availability'] })
      toast.success('Abwesenheit eingetragen')
      onClose()
    },
    onError: () => {
      toast.error('Fehler beim Speichern der Abwesenheit')
    },
  })

  // ESC schließt
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validTo) return
    mutation.mutate({
      doctor_id: doctorId,
      absence_type: absenceType,
      valid_from: validFrom,
      valid_to: validTo,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
  }

  const fromDisplay = (() => {
    try { return format(parseISO(validFrom), 'dd.MM.yyyy', { locale: de }) } catch { return validFrom }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 w-80 rounded-xl border border-line bg-card shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-line">
          <div className="text-[13px] font-semibold text-ink">Abwesenheit eintragen</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{doctorName}</div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-3 flex flex-col gap-3">
          {/* Typ Badge (read-only) */}
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Typ</div>
            <span className="px-2.5 py-1 rounded-md border border-[#d4c8b4] text-[11px] font-semibold bg-[#FFF8F0] text-[#7a5c3a]">
              {ABSENCE_LABELS[absenceType]}
            </span>
          </div>

          {/* Von / Bis */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Von
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-line bg-paper text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Bis <span className="text-accent">*</span>
              </label>
              <input
                type="date"
                value={validTo}
                min={validFrom}
                onChange={(e) => setValidTo(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded-md border text-[12px] text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                style={{ borderColor: !validTo ? '#C66A3D' : undefined }}
              />
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
              Notizen <span className="font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2.5 py-1.5 rounded-md border border-line bg-card text-[12px] text-ink resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="…"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-line text-[12px] text-ink-3 bg-paper hover:bg-paper/80 transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!validTo || mutation.isPending}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-accent text-white hover:bg-accent/90 transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler. Falls `apiPost` kein generisches TypeArg hat: `apiPost(...)` ohne `<Absence>` verwenden.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/features/plans/components/AbsenceAssignPopover.tsx
git commit -m "feat(plans): AbsenceAssignPopover — Zeitraum-Dialog nach Absence-Drop"
```

---

## Task 5: UnifiedShiftCell — absenceId + Doppelklick-Delete

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedShiftCell.tsx`

- [ ] **Schritt 1: Props-Interface erweitern**

In `UnifiedShiftCellProps` (nach `isHighlightedRow`) zwei neue Props hinzufügen:

```typescript
// Nach isHighlightedRow, vor onMouseEnter:
absenceId?: number
onDoubleClickRemoveAbsence?: (absenceId: number) => void
```

- [ ] **Schritt 2: Neue Props in Destrukturierung aufnehmen**

```typescript
export function UnifiedShiftCell({
  // ... bestehende Props ...
  isHighlightedRow,
  absenceId,                       // NEU
  onDoubleClickRemoveAbsence,       // NEU
  onMouseEnter,
  // ...
}: UnifiedShiftCellProps) {
```

- [ ] **Schritt 3: handleClick — 300ms-Delay auch für Absence-Zellen**

Bestehende Logik in `handleClick` anpassen — Delay tritt jetzt auch bei `absenceId` auf:

```typescript
function handleClick(e: React.MouseEvent) {
  const { shiftKey } = e
  const needsDoubleClickDelay =
    (onDoubleClickRemove && shiftAssigned) ||
    (onDoubleClickRemoveAbsence && absenceId !== undefined)

  if (needsDoubleClickDelay) {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    clickTimerRef.current = setTimeout(() => { onClick?.(shiftKey) }, 300)
  } else {
    onClick?.(shiftKey)
  }
}
```

- [ ] **Schritt 4: handleDoubleClick — Absence vor Shift prüfen**

```typescript
function handleDoubleClick() {
  if (clickTimerRef.current) {
    clearTimeout(clickTimerRef.current)
    clickTimerRef.current = null
  }
  // Absence-Delete hat Vorrang vor Shift-Delete
  if (absenceId !== undefined) {
    onDoubleClickRemoveAbsence?.(absenceId)
    return
  }
  if (!shiftAssigned) return
  if (isPinned) {
    toast.info('Gepinnte Schicht — erst entpinnen')
    return
  }
  onDoubleClickRemove?.()
}
```

- [ ] **Schritt 5: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 6: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedShiftCell.tsx
git commit -m "feat(plans): UnifiedShiftCell — absenceId + Doppelklick-Delete für Abwesenheiten"
```

---

## Task 6: UnifiedPlanGrid — absenceId durchschleifen

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

- [ ] **Schritt 1: Props-Interface erweitern**

In `UnifiedPlanGridProps` nach `onDoubleClickRemove` einfügen:

```typescript
onDoubleClickRemoveAbsence?: (absenceId: number) => void  // NEU
```

- [ ] **Schritt 2: Neue Prop in Destrukturierung aufnehmen**

```typescript
export function UnifiedPlanGrid({
  // ... bestehende Props ...
  onDoubleClickRemove,
  onDoubleClickRemoveAbsence,  // NEU
  // ...
}: UnifiedPlanGridProps) {
```

- [ ] **Schritt 3: absenceId an UnifiedShiftCell übergeben**

Den Bereich finden, wo `<UnifiedShiftCell>` gerendert wird. Dort `resolved.absenceId` und den neuen Callback hinzufügen:

```typescript
const resolved = resolveCell(row, dayKey, shifts, absences)
// ...
<UnifiedShiftCell
  // ... bestehende Props ...
  absenceId={resolved.absenceId ?? undefined}              // NEU
  onDoubleClickRemoveAbsence={onDoubleClickRemoveAbsence}  // NEU
  // ...
/>
```

- [ ] **Schritt 4: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(plans): UnifiedPlanGrid — absenceId und onDoubleClickRemoveAbsence durchschleifen"
```

---

## Task 7: ShiftTypeDragBar — "Alle Dienste"-Button rein

**Files:**
- Modify: `frontend/src/features/plans/components/ShiftTypeDragBar.tsx`

- [ ] **Schritt 1: Props-Interface erweitern**

```typescript
interface ShiftTypeDragBarProps {
  shiftTypes: ShiftType[]
  focusMode: 'alle' | 'vn'
  onFocusToggle: () => void  // NEU
}
```

- [ ] **Schritt 2: Neue Prop destrukturieren und Button einbauen**

```typescript
export function ShiftTypeDragBar({ shiftTypes, focusMode, onFocusToggle }: ShiftTypeDragBarProps) {
  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card"
      aria-label="Dienst-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
        Dienste
      </span>
      {shiftTypes.map((st) => {
        const isVN = st.short_name === 'V' || st.short_name === 'N'
        return (
          <ShiftTypeChip
            key={st.id}
            shiftType={st}
            dimmed={focusMode === 'vn' && !isVN}
          />
        )
      })}
      {/* "Alle Dienste"-Toggle wandert aus PlanPage hierher */}
      <button
        onClick={onFocusToggle}
        className={[
          'ml-auto px-3 py-1 rounded-lg text-xs font-medium border transition self-center',
          focusMode === 'vn'
            ? 'bg-accent text-white border-accent'
            : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
        ].join(' ')}
      >
        {focusMode === 'vn' ? 'Fokus: V+N' : 'Alle Dienste'}
      </button>
    </div>
  )
}
```

- [ ] **Schritt 3: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: Fehler in PlanPage (fehlende Prop `onFocusToggle`) — wird in Task 8 behoben.

- [ ] **Schritt 4: Commit**

```bash
git add frontend/src/features/plans/components/ShiftTypeDragBar.tsx
git commit -m "feat(plans): ShiftTypeDragBar — Alle-Dienste-Toggle rein, onFocusToggle Prop"
```

---

## Task 8: PlanPage — alles verdrahten

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Schritt 1: Neue Imports hinzufügen**

Folgende Imports oben einfügen (nach bestehenden Imports):

```typescript
import { AbsenceTypeDragBar, parseAbsenceDragId } from './components/AbsenceTypeDragBar'
import { AbsenceAssignPopover } from './components/AbsenceAssignPopover'
import { useDeleteAbsence } from './useDeleteAbsence'
import type { AbsenceType } from '@/lib/types'
```

- [ ] **Schritt 2: Neuer State + Hook**

Nach `const [highlightedDoctorId, ...] = useState<...>(null)`:

```typescript
const [activeAbsenceCell, setActiveAbsenceCell] = useState<{
  type: AbsenceType
  doctorId: number
  doctorName: string
  dayKey: string
} | null>(null)
const [pendingDeleteAbsence, setPendingDeleteAbsence] = useState<{
  id: number
  label: string
  from: string
  to: string
} | null>(null)

const deleteAbsence = useDeleteAbsence(id)
```

- [ ] **Schritt 3: Absence-Label-Map für Delete-Dialog**

Nach dem `deleteAbsence`-Hook:

```typescript
const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  URLAUB:       'Urlaub',
  KRANKHEIT:    'Krankheit',
  FORTBILDUNG:  'Fortbildung',
  ELTERNZEIT:   'Elternzeit',
  MUTTERSCHUTZ: 'Mutterschutz',
  SONSTIGES:    'Sonstiges',
}
```

- [ ] **Schritt 4: handleDragEnd — Absence-Drop-Handler einbauen**

In `handleDragEnd`, NACH dem Doctor-Drop-Block (`if (doctorId !== null) { ... return }`) und VOR der Zeile `const shiftTypeId = parseShiftTypeDragId(activeId)`:

```typescript
// ── Absence → Cell-Drop ───────────────────────────────────────────────────
const absenceType = parseAbsenceDragId(activeId)
if (absenceType !== null) {
  const cellMatch = overId.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
  if (!cellMatch) return
  const rotationId = Number(cellMatch[1])
  const dayKey = cellMatch[2]
  const rotation = rotations.find((r) => r.id === rotationId)
  if (!rotation) return
  const doctor = doctors.find((d) => d.id === rotation.doctor_id)
  setActiveAbsenceCell({
    type: absenceType,
    doctorId: rotation.doctor_id,
    doctorName: doctor?.name ?? '',
    dayKey,
  })
  return
}
```

- [ ] **Schritt 5: handleDoubleClickRemoveAbsence hinzufügen**

```typescript
function handleDoubleClickRemoveAbsence(absenceId: number) {
  const absence = absences.find((a) => a.id === absenceId)
  if (!absence) return
  const fromFmt = (() => {
    try { return format(parseISO(absence.valid_from), 'dd.MM.', { locale: de }) } catch { return absence.valid_from }
  })()
  const toFmt = (() => {
    try { return format(parseISO(absence.valid_to), 'dd.MM.yyyy', { locale: de }) } catch { return absence.valid_to }
  })()
  setPendingDeleteAbsence({
    id: absenceId,
    label: ABSENCE_TYPE_LABELS[absence.absence_type] ?? absence.absence_type,
    from: fromFmt,
    to: toFmt,
  })
}
```

- [ ] **Schritt 6: Layout-Änderung — DragBar-Zeile**

Den Block `{/* ShiftType-DragBar + Fokus-Toggle */}` ersetzen:

```tsx
{/* DnD-Bars: Dienste + Abwesenheiten */}
<div className="px-6 pb-2 flex items-center gap-3">
  <ShiftTypeDragBar
    shiftTypes={shiftTypes}
    focusMode={focusMode}
    onFocusToggle={() => setFocusMode((m) => (m === 'alle' ? 'vn' : 'alle'))}
  />
  <AbsenceTypeDragBar />
</div>
```

Den alten `<button>` für "Alle Dienste" außerhalb des Blocks vollständig entfernen.

- [ ] **Schritt 7: onDoubleClickRemoveAbsence an UnifiedPlanGrid übergeben**

```tsx
<UnifiedPlanGrid
  {/* ... bestehende Props ... */}
  onDoubleClickRemoveAbsence={handleDoubleClickRemoveAbsence}  // NEU
/>
```

- [ ] **Schritt 8: AbsenceAssignPopover rendern**

Nach dem `{activeCell && <DoctorAssignPopover ... />}` Block:

```tsx
{activeAbsenceCell && (
  <AbsenceAssignPopover
    doctorId={activeAbsenceCell.doctorId}
    doctorName={activeAbsenceCell.doctorName}
    absenceType={activeAbsenceCell.type}
    defaultFrom={activeAbsenceCell.dayKey}
    planId={id}
    onClose={() => setActiveAbsenceCell(null)}
  />
)}
```

- [ ] **Schritt 9: AlertDialog für Absence-Delete hinzufügen**

Nach dem letzten `<AlertDialog>` (showDeleteDialog) vor dem schließenden `</>`:

```tsx
<AlertDialog
  open={pendingDeleteAbsence !== null}
  onOpenChange={(open) => { if (!open) setPendingDeleteAbsence(null) }}
>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Abwesenheit löschen?</AlertDialogTitle>
      <AlertDialogDescription>
        <strong>{pendingDeleteAbsence?.label}</strong>{' '}
        {pendingDeleteAbsence?.from}–{pendingDeleteAbsence?.to} wird vollständig gelöscht.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setPendingDeleteAbsence(null)}>
        Abbrechen
      </AlertDialogCancel>
      <AlertDialogAction
        className="bg-red-600 hover:bg-red-700 text-white"
        onClick={() => {
          if (!pendingDeleteAbsence) return
          deleteAbsence.mutate(pendingDeleteAbsence.id, {
            onSuccess: () => toast.success('Abwesenheit gelöscht'),
            onError: () => toast.error('Löschen fehlgeschlagen'),
          })
          setPendingDeleteAbsence(null)
        }}
        disabled={deleteAbsence.isPending}
      >
        Löschen
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

- [ ] **Schritt 10: TypeScript-Check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 Fehler

- [ ] **Schritt 11: Dev-Server starten und manuell testen**

```bash
cd frontend && pnpm dev
```

Testpfad:
1. Plan öffnen → Abwesenheits-Zone rechts neben Dienste-Zone sichtbar
2. "Alle Dienste"/"Fokus: V+N"-Button in Dienste-Zone sichtbar
3. "U"-Chip auf Arzt-Zelle ziehen → Popover öffnet mit vorausgefülltem Datum
4. Bis-Datum eingeben, Speichern → Zelle zeigt "U"
5. "FB"-Chip auf Arzt-Zelle ziehen → Popover mit "FB — Fortbildung"
6. Doppelklick auf Absence-Zelle → Confirmation-Dialog mit Zeitraum
7. Bestätigen → Zelle leert sich

- [ ] **Schritt 12: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Abwesenheits-DnD — Drop-Handler, Popover, Delete-Dialog, neues Layout"
```

---

## Abschluss-Commit

```bash
git log --oneline -8
```

Alle 8 Commits sichtbar. Feature vollständig.
