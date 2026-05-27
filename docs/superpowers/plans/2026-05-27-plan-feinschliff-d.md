# Plan-Feinschliff D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Voraussetzung:** Plan A–C muss implementiert sein (`useUpdatePlan`, `useDeletePlan`, Absence-Mutations vorhanden).

**Goal:** Undo/Redo für alle Planungsaktionen (localStorage-persistiert) + Abwesenheits-DnD direkt aus dem Planungsmodus.

**Architecture:** `useHistoryStore` (Zustand + persist) speichert serialisierbare Aktions-Descriptors. Ein `useUndoRedo`-Hook verbindet den Store mit QueryClient für Invalidierungen. Jede Mutation ruft nach Erfolg `push(entry)` auf. Absence-DnD erweitert die ShiftTypeDragBar um eine zweite Zone mit Absence-Chips; Drop öffnet `AbsenceAssignDialog` analog zu `RotationAssignPopover`. Plan-Löschung ist aus Undo ausgeschlossen (zu destruktiv — durch Name-Bestätigung geschützt, bereits in Plan A–C implementiert).

**Tech Stack:** React 18, TypeScript, Zustand + persist middleware, TanStack Query v5, dnd-kit, FastAPI (für POST /api/absences falls noch nicht vorhanden)

---

## File Map

**Neue Dateien:**
- `frontend/src/stores/useHistoryStore.ts` — Zustand-Store mit serialisierbarer Command-History, localStorage-persistiert
- `frontend/src/features/plans/useUndoRedo.ts` — Hook: verbindet Store mit QueryClient, liefert undo/redo/canUndo/canRedo
- `frontend/src/features/plans/components/AbsenceTypeDragBar.tsx` — Drag-Chips für die 6 Abwesenheitstypen
- `frontend/src/features/plans/components/AbsenceAssignDialog.tsx` — Dialog zur Zeitraum-Eingabe bei Absence-Drop

**Modifizierte Dateien:**
- `frontend/src/features/plans/useAssignShift.ts` — push(ASSIGN_SHIFT) nach onSuccess
- `frontend/src/features/plans/usePlanRotations.ts` — push(CREATE/DELETE/UPDATE_ROTATION) nach onSuccess
- `frontend/src/features/plans/useUpdatePlan.ts` — push(UPDATE_PLAN_STATUS) nach onSuccess
- `frontend/src/features/plans/PlanPage.tsx` — Undo/Redo-Buttons in CommandBar, Absence-Drop-Handler, Ctrl+Z/Y-Shortcuts
- `frontend/src/features/plans/components/ShiftTypeDragBar.tsx` — Layout zu zwei Zonen umbauen

---

## Wichtige Vorab-Checks

Bevor du beginnst, prüfe:

```bash
# Absence-API prüfen:
grep -rn "api/absences\|/absences" backend/app/api/ | head -10

# Absence-Typen im Frontend prüfen:
grep -n "AbsenceType\|URLAUB\|KRANKHEIT" frontend/src/lib/types.ts | head -10

# usePlanRotations — welche Mutationen existieren:
cat frontend/src/features/plans/usePlanRotations.ts

# Wie PlanPage den Absence-Hook nutzt:
grep -n "absence\|Absence" frontend/src/features/plans/PlanPage.tsx | head -15
```

---

### Task 1: useHistoryStore

**Files:**
- Create: `frontend/src/stores/useHistoryStore.ts`

Der Store ist zustandslos bezüglich React — keine Hooks, kein QueryClient. Er hält nur die Daten.

- [ ] **Step 1: Typen prüfen und Store erstellen**

Prüfe zuerst die relevanten Typen:
```bash
grep -n "RotationAssignmentWithDetails\|AbsenceWithDetails\|PlanStatus\|RotationUpdate\|AbsenceUpdate" frontend/src/lib/types.ts | head -20
```

```typescript
// frontend/src/stores/useHistoryStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Serialisierbare Aktions-Descriptors (keine Funktionen, keine Klassen):
export type HistoryEntry =
  | {
      type: 'ASSIGN_SHIFT'
      shiftId: number
      oldDoctorId: number | null
      newDoctorId: number | null
      description: string
    }
  | {
      type: 'CREATE_ROTATION'
      rotationId: number
      planId: number
      departmentId: number
      doctorId: number
      validFrom: string
      validTo: string
      description: string
    }
  | {
      type: 'DELETE_ROTATION'
      rotationId: number
      planId: number
      departmentId: number
      doctorId: number
      validFrom: string
      validTo: string
      description: string
    }
  | {
      type: 'UPDATE_ROTATION'
      rotationId: number
      oldValidFrom: string
      oldValidTo: string
      newValidFrom: string
      newValidTo: string
      description: string
    }
  | {
      type: 'UPDATE_PLAN_STATUS'
      planId: number
      oldStatus: string
      newStatus: string
      description: string
    }
  | {
      type: 'CREATE_ABSENCE'
      absenceId: number
      doctorId: number
      absenceType: string
      validFrom: string
      validTo: string
      description: string
    }
  | {
      type: 'DELETE_ABSENCE'
      absenceId: number
      doctorId: number
      absenceType: string
      validFrom: string
      validTo: string
      description: string
    }

const MAX_HISTORY = 50

interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]
  push: (entry: HistoryEntry) => void
  popPast: () => HistoryEntry | null
  popFuture: () => HistoryEntry | null
  pushFuture: (entry: HistoryEntry) => void
  pushPast: (entry: HistoryEntry) => void
  clear: () => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      past: [],
      future: [],

      push: (entry) =>
        set((s) => ({
          past: [...s.past.slice(-(MAX_HISTORY - 1)), entry],
          future: [],
        })),

      popPast: () => {
        const { past } = get()
        if (past.length === 0) return null
        const entry = past[past.length - 1]
        set((s) => ({ past: s.past.slice(0, -1) }))
        return entry
      },

      popFuture: () => {
        const { future } = get()
        if (future.length === 0) return null
        const entry = future[future.length - 1]
        set((s) => ({ future: s.future.slice(0, -1) }))
        return entry
      },

      pushFuture: (entry) => set((s) => ({ future: [...s.future, entry] })),
      pushPast: (entry) => set((s) => ({ past: [...s.past, entry] })),

      clear: () => set({ past: [], future: [] }),
    }),
    { name: 'dp-history' }
  )
)
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/useHistoryStore.ts
git commit -m "feat(history): useHistoryStore mit localStorage-Persistenz (D1)"
```

---

### Task 2: useUndoRedo Hook

**Files:**
- Create: `frontend/src/features/plans/useUndoRedo.ts`

Dieser Hook verbindet den Store mit QueryClient und führt die API-Calls für Undo/Redo aus.

- [ ] **Step 1: API-Imports und Query-Key-Imports prüfen**

```bash
grep -n "export.*apiPatch\|export.*apiPost\|export.*apiDelete" frontend/src/lib/api.ts
grep -n "export.*planKeys\|export.*shiftQueryKeys\|export.*conflictQueryKeys\|export.*planAbsenceKeys" frontend/src/features/plans/*.ts
```

- [ ] **Step 2: useUndoRedo Hook erstellen**

```typescript
// frontend/src/features/plans/useUndoRedo.ts
import { useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiPatch, apiPost } from '@/lib/api'
import { useHistoryStore, type HistoryEntry } from '@/stores/useHistoryStore'
import { planKeys } from './usePlans'
import { shiftQueryKeys } from './usePlanShifts'
import { conflictQueryKeys } from './usePlanConflicts'
import { tarifWarningKeys } from './useTarifWarnings'
import { planAbsenceKeys } from './usePlanAbsences'

// Query-Keys nach Undo/Redo invalidieren:
function invalidateForEntry(
  qc: ReturnType<typeof useQueryClient>,
  entry: HistoryEntry,
  planId: number
) {
  switch (entry.type) {
    case 'ASSIGN_SHIFT':
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })
      break
    case 'CREATE_ROTATION':
    case 'DELETE_ROTATION':
    case 'UPDATE_ROTATION':
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      // Rotations-Queries invalidieren (Query-Key aus usePlanRotations prüfen):
      void qc.invalidateQueries({ queryKey: ['plans', planId, 'rotations'] })
      break
    case 'UPDATE_PLAN_STATUS':
      void qc.invalidateQueries({ queryKey: planKeys.detail(planId) })
      void qc.invalidateQueries({ queryKey: planKeys.list() })
      break
    case 'CREATE_ABSENCE':
    case 'DELETE_ABSENCE':
      void qc.invalidateQueries({ queryKey: planAbsenceKeys.byPlan(planId) })
      break
  }
}

// API-Call für Undo (Umkehrung):
async function executeUndo(entry: HistoryEntry): Promise<void> {
  switch (entry.type) {
    case 'ASSIGN_SHIFT':
      await apiPatch(`/api/shifts/${entry.shiftId}`, { doctor_id: entry.oldDoctorId })
      break
    case 'CREATE_ROTATION':
      await apiDelete(`/api/rotations/${entry.rotationId}`)
      break
    case 'DELETE_ROTATION':
      await apiPost(`/api/plans/${entry.planId}/rotations`, {
        department_id: entry.departmentId,
        doctor_id: entry.doctorId,
        valid_from: entry.validFrom,
        valid_to: entry.validTo,
      })
      break
    case 'UPDATE_ROTATION':
      await apiPatch(`/api/rotations/${entry.rotationId}`, {
        valid_from: entry.oldValidFrom,
        valid_to: entry.oldValidTo,
      })
      break
    case 'UPDATE_PLAN_STATUS':
      await apiPatch(`/api/plans/${entry.planId}`, { status: entry.oldStatus })
      break
    case 'CREATE_ABSENCE':
      await apiDelete(`/api/absences/${entry.absenceId}`)
      break
    case 'DELETE_ABSENCE':
      await apiPost(`/api/absences`, {
        doctor_id: entry.doctorId,
        absence_type: entry.absenceType,
        valid_from: entry.validFrom,
        valid_to: entry.validTo,
      })
      break
  }
}

// API-Call für Redo (Original):
async function executeRedo(entry: HistoryEntry): Promise<void> {
  switch (entry.type) {
    case 'ASSIGN_SHIFT':
      await apiPatch(`/api/shifts/${entry.shiftId}`, { doctor_id: entry.newDoctorId })
      break
    case 'CREATE_ROTATION':
      await apiPost(`/api/plans/${entry.planId}/rotations`, {
        department_id: entry.departmentId,
        doctor_id: entry.doctorId,
        valid_from: entry.validFrom,
        valid_to: entry.validTo,
      })
      break
    case 'DELETE_ROTATION':
      await apiDelete(`/api/rotations/${entry.rotationId}`)
      break
    case 'UPDATE_ROTATION':
      await apiPatch(`/api/rotations/${entry.rotationId}`, {
        valid_from: entry.newValidFrom,
        valid_to: entry.newValidTo,
      })
      break
    case 'UPDATE_PLAN_STATUS':
      await apiPatch(`/api/plans/${entry.planId}`, { status: entry.newStatus })
      break
    case 'CREATE_ABSENCE':
      await apiPost(`/api/absences`, {
        doctor_id: entry.doctorId,
        absence_type: entry.absenceType,
        valid_from: entry.validFrom,
        valid_to: entry.validTo,
      })
      break
    case 'DELETE_ABSENCE':
      await apiDelete(`/api/absences/${entry.absenceId}`)
      break
  }
}

export function useUndoRedo(planId: number) {
  const qc = useQueryClient()
  const store = useHistoryStore()

  const canUndo = store.past.length > 0
  const canRedo = store.future.length > 0
  const lastUndoDescription = store.past[store.past.length - 1]?.description
  const lastRedoDescription = store.future[store.future.length - 1]?.description

  async function undo() {
    const entry = store.popPast()
    if (!entry) return
    try {
      await executeUndo(entry)
      store.pushFuture(entry)
      invalidateForEntry(qc, entry, planId)
    } catch (err) {
      // Bei Fehler Entry zurücklegen:
      store.pushPast(entry)
      console.error('Undo fehlgeschlagen:', err)
    }
  }

  async function redo() {
    const entry = store.popFuture()
    if (!entry) return
    try {
      await executeRedo(entry)
      store.pushPast(entry)
      invalidateForEntry(qc, entry, planId)
    } catch (err) {
      store.pushFuture(entry)
      console.error('Redo fehlgeschlagen:', err)
    }
  }

  return { undo, redo, canUndo, canRedo, lastUndoDescription, lastRedoDescription }
}
```

**Hinweis zu Query-Keys:** Prüfe die exakten Query-Key-Formen in `usePlanRotations.ts`:
```bash
grep -n "queryKey\|rotationKeys" frontend/src/features/plans/usePlanRotations.ts
```
Passe `['plans', planId, 'rotations']` an den tatsächlichen Key an.

Prüfe auch `planAbsenceKeys`:
```bash
grep -n "planAbsenceKeys\|byPlan" frontend/src/features/plans/usePlanAbsences.ts
```

- [ ] **Step 3: Prüfe ob /api/absences DELETE-Endpoint existiert**

```bash
grep -n "DELETE\|def delete_absence" backend/app/api/absences.py 2>/dev/null || grep -rn "absences" backend/app/api/
```

Falls DELETE /api/absences/{id} fehlt, muss es für Undo/Redo-Support hinzugefügt werden. Prüfe auch POST /api/absences. Falls Absence-API nicht vollständig ist, notiere die Lücken und implementiere sie im Backend-Schritt weiter unten.

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/useUndoRedo.ts
git commit -m "feat(history): useUndoRedo Hook mit Undo/Redo API-Calls (D1)"
```

---

### Task 3: History in useAssignShift integrieren (D1)

**Files:**
- Modify: `frontend/src/features/plans/useAssignShift.ts`

- [ ] **Step 1: useAssignShift lesen**

```bash
cat frontend/src/features/plans/useAssignShift.ts
```

- [ ] **Step 2: History-Push nach onSuccess hinzufügen**

Problem: `useAssignShift` kennt `oldDoctorId` nicht (die Mutation-Fn erhält nur `newDoctorId`). Lösung: `oldDoctorId` als Input mitgeben.

```typescript
// frontend/src/features/plans/useAssignShift.ts — vollständige neue Version:
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { ShiftUpdate, ShiftWithDetails } from '@/lib/types'
import { shiftQueryKeys } from './usePlanShifts'
import { conflictQueryKeys } from './usePlanConflicts'
import { tarifWarningKeys } from './useTarifWarnings'
import { useHistoryStore } from '@/stores/useHistoryStore'

export function useAssignShift(planId: number) {
  const qc = useQueryClient()
  const { push } = useHistoryStore()

  return useMutation({
    mutationFn: ({
      shiftId,
      data,
      oldDoctorId,  // neu: für History
    }: {
      shiftId: number
      data: ShiftUpdate
      oldDoctorId?: number | null
    }) => apiPatch<ShiftWithDetails>(`/api/shifts/${shiftId}`, data),

    onSuccess: (result, variables) => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: tarifWarningKeys.byPlan(planId) })

      // History-Eintrag:
      push({
        type: 'ASSIGN_SHIFT',
        shiftId: variables.shiftId,
        oldDoctorId: variables.oldDoctorId ?? null,
        newDoctorId: variables.data.doctor_id ?? null,
        description: variables.data.doctor_id
          ? 'Schicht zugewiesen'
          : 'Schichtzuweisung entfernt',
      })
    },
  })
}

// findShiftId bleibt unverändert (falls vorhanden):
export { findShiftId } from './useAssignShift'  // entferne diese Zeile und behalte findShiftId in der Datei
```

**Wichtig:** Die Signatur-Änderung (`oldDoctorId` neu) muss in allen `assignShift.mutate()`-Aufrufen in PlanPage ergänzt werden. Suche alle Stellen:

```bash
grep -n "assignShift.mutate" frontend/src/features/plans/PlanPage.tsx
```

Ergänze `oldDoctorId` wo der vorherige Arzt bekannt ist. Wo er unbekannt ist (z.B. direkter Drop ohne Prior-State), `oldDoctorId: undefined` übergeben — History wird trotzdem eingetragen, aber Undo setzt auf `null`.

- [ ] **Step 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/plans/useAssignShift.ts frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(history): History-Push in useAssignShift (D1)"
```

---

### Task 4: History in usePlanRotations integrieren (D1)

**Files:**
- Modify: `frontend/src/features/plans/usePlanRotations.ts`

- [ ] **Step 1: usePlanRotations lesen**

```bash
cat frontend/src/features/plans/usePlanRotations.ts
```

Identifiziere `useCreateRotation`, `useDeleteRotation`, `useUpdateRotation`.

- [ ] **Step 2: History in useCreateRotation**

```typescript
// In useCreateRotation onSuccess:
import { useHistoryStore } from '@/stores/useHistoryStore'

const { push } = useHistoryStore()

// onSuccess:
onSuccess: (result, variables) => {
  // bestehende Invalidierungen...
  push({
    type: 'CREATE_ROTATION',
    rotationId: result.id,
    planId,
    departmentId: variables.department_id,
    doctorId: variables.doctor_id,
    validFrom: variables.valid_from,
    validTo: variables.valid_to,
    description: `Rotation erstellt`,
  })
}
```

Prüfe die Felder des `RotationAssignmentCreate`-Typs um korrekte Feldnamen zu verwenden:
```bash
grep -n "RotationAssignmentCreate\|RotationAssignment" frontend/src/lib/types.ts | head -10
```

- [ ] **Step 3: History in useDeleteRotation**

Das Problem: beim Löschen muss die Rotation-Daten vorher bekannt sein (für Undo-Restore). Lösung: `deleteRotation.mutate({ rotationId, rotationData })` — Aufrufer gibt die vollständigen Daten mit.

```typescript
// useDeleteRotation:
return useMutation({
  mutationFn: ({ rotationId }: { rotationId: number; rotation: RotationAssignmentWithDetails }) =>
    apiDelete(`/api/rotations/${rotationId}`),

  onSuccess: (_, variables) => {
    // bestehende Invalidierungen...
    push({
      type: 'DELETE_ROTATION',
      rotationId: variables.rotationId,
      planId,
      departmentId: variables.rotation.department_id,
      doctorId: variables.rotation.doctor_id,
      validFrom: variables.rotation.valid_from,
      validTo: variables.rotation.valid_to,
      description: `Rotation gelöscht`,
    })
  },
})
```

Alle `deleteRotation.mutate(rotationId)`-Aufrufe müssen auf `deleteRotation.mutate({ rotationId, rotation })` geändert werden. Suche alle Stellen:

```bash
grep -rn "deleteRotation.mutate\|deleteMutate" frontend/src/features/plans/
```

- [ ] **Step 4: History in useUpdateRotation**

```typescript
// updateRotation muss old values kennen — Aufrufer muss oldValidFrom/To mitgeben:
return useMutation({
  mutationFn: ({
    rotationId,
    data,
  }: {
    rotationId: number
    data: RotationAssignmentUpdate
    oldValidFrom: string
    oldValidTo: string
  }) => apiPatch(`/api/rotations/${rotationId}`, data),

  onSuccess: (result, variables) => {
    // bestehende Invalidierungen...
    push({
      type: 'UPDATE_ROTATION',
      rotationId: variables.rotationId,
      oldValidFrom: variables.oldValidFrom,
      oldValidTo: variables.oldValidTo,
      newValidFrom: variables.data.valid_from ?? variables.oldValidFrom,
      newValidTo: variables.data.valid_to ?? variables.oldValidTo,
      description: `Rotationszeitraum geändert`,
    })
  },
})
```

Alle `updateMutate`-Aufrufe in `RotationAssignPopover.tsx` anpassen.

- [ ] **Step 5: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/plans/usePlanRotations.ts frontend/src/features/plans/components/RotationAssignPopover.tsx
git commit -m "feat(history): History-Push in usePlanRotations (D1)"
```

---

### Task 5: History in useUpdatePlan integrieren (D1)

**Files:**
- Modify: `frontend/src/features/plans/useUpdatePlan.ts`

- [ ] **Step 1: useUpdatePlan anpassen**

`useUpdatePlan` muss den alten Status kennen. Lösung: `oldStatus` als zusätzliches Mutations-Argument mitgeben.

```typescript
// frontend/src/features/plans/useUpdatePlan.ts — neue Version:
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { PlanUpdate, PlanWithRelations } from '@/lib/types'
import { planKeys } from './usePlans'
import { useHistoryStore } from '@/stores/useHistoryStore'

export function useUpdatePlan(planId: number) {
  const qc = useQueryClient()
  const { push } = useHistoryStore()

  return useMutation({
    mutationFn: ({
      data,
    }: {
      data: PlanUpdate
      oldStatus?: string
    }) => apiPatch<PlanWithRelations>(`/api/plans/${planId}`, data),

    onSuccess: (result, variables) => {
      void qc.invalidateQueries({ queryKey: planKeys.detail(planId) })
      void qc.invalidateQueries({ queryKey: planKeys.list() })

      if (variables.data.status && variables.oldStatus) {
        push({
          type: 'UPDATE_PLAN_STATUS',
          planId,
          oldStatus: variables.oldStatus,
          newStatus: variables.data.status,
          description: `Plan-Status zu ${variables.data.status === 'RELEASED' ? 'Freigegeben' : 'Entwurf'} geändert`,
        })
      }
    },
  })
}
```

In `PlanPage.tsx`, `handleStatusToggle` anpassen:

```typescript
function handleStatusToggle() {
  if (!plan) return
  const newStatus = plan.status === 'DRAFT' ? 'RELEASED' : 'DRAFT'
  updatePlan.mutate({ data: { status: newStatus }, oldStatus: plan.status })
}
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/plans/useUpdatePlan.ts frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(history): History-Push in useUpdatePlan (D1)"
```

---

### Task 6: Undo/Redo UI — Buttons + globale Shortcuts (D1)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: useUndoRedo in PlanPage einbinden**

```typescript
// Import:
import { useUndoRedo } from './useUndoRedo'
import { Undo2, Redo2 } from 'lucide-react'

// In der Komponente:
const { undo, redo, canUndo, canRedo, lastUndoDescription, lastRedoDescription } = useUndoRedo(planId)
```

- [ ] **Step 2: Keyboard-Shortcuts für Ctrl+Z / Ctrl+Y**

```typescript
useEffect(() => {
  function handleUndoRedoKey(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (!mod) return

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      void undo()
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault()
      void redo()
    }
  }

  document.addEventListener('keydown', handleUndoRedoKey)
  return () => document.removeEventListener('keydown', handleUndoRedoKey)
}, [undo, redo])
```

- [ ] **Step 3: Undo/Redo-Buttons zu CommandBar extras hinzufügen**

Erweitere die `extras`-JSX aus Plan A–C (Task 7/9) um Undo/Redo-Buttons:

```typescript
extras={plan ? (
  <div className="flex items-center gap-2">
    {/* Undo/Redo-Buttons: */}
    <div className="flex items-center gap-0.5 mr-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void undo()}
        disabled={!canUndo}
        title={canUndo ? `Rückgängig: ${lastUndoDescription}` : 'Nichts rückgängig zu machen'}
        aria-label="Rückgängig"
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void redo()}
        disabled={!canRedo}
        title={canRedo ? `Wiederholen: ${lastRedoDescription}` : 'Nichts zu wiederholen'}
        aria-label="Wiederholen"
      >
        <Redo2 className="size-4" />
      </Button>
    </div>

    {/* Status-Badge, Status-Toggle, Löschen-Button aus Plan A–C: */}
    ...
  </div>
) : undefined}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(history): Undo/Redo Buttons + Ctrl+Z/Y Shortcuts in PlanPage (D1)"
```

---

### Task 7: Backend — Absence-API prüfen und ergänzen (D2)

**Files:**
- Modify: `backend/app/api/absences.py` (falls DELETE-Endpoint fehlt)

- [ ] **Step 1: Absence-API-Vollständigkeit prüfen**

```bash
cat backend/app/api/absences.py
```

Prüfe ob vorhanden:
- `POST /api/absences` — Abwesenheit erstellen
- `DELETE /api/absences/{id}` — Abwesenheit löschen (für Undo von CREATE_ABSENCE)

- [ ] **Step 2: DELETE-Endpoint hinzufügen falls fehlend**

Prüfe zuerst Repository:
```bash
grep -n "def delete_absence\|def get_absence" backend/app/repositories/absence_repository.py
```

Falls `delete_absence` fehlt:
```python
# In absence_repository.py:
def delete_absence(db: Session, absence_id: int) -> bool:
    absence = db.get(Absence, absence_id)
    if absence is None:
        return False
    db.delete(absence)
    db.commit()
    return True
```

Falls DELETE-Endpoint fehlt:
```python
# In absences.py:
from app.services.exceptions import AbsenceNotFoundError  # oder eigenes 404

@router.delete("/{absence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_absence(absence_id: int, db: Session = Depends(get_db)):
    deleted = absence_repo.delete_absence(db, absence_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Abwesenheit nicht gefunden")
```

- [ ] **Step 3: Backend-Tests laufen**

```bash
cd backend && python -m pytest -x -q
```

- [ ] **Step 4: Commit (nur wenn Änderungen nötig waren)**

```bash
git add backend/app/api/absences.py backend/app/repositories/absence_repository.py
git commit -m "feat(backend): DELETE /api/absences/{id} für Undo-Support (D2)"
```

---

### Task 8: AbsenceTypeDragBar Komponente (D2)

**Files:**
- Create: `frontend/src/features/plans/components/AbsenceTypeDragBar.tsx`

- [ ] **Step 1: Absence-Typ-Mapping prüfen**

```bash
grep -n "URLAUB\|KRANKHEIT\|AbsenceType\|absence_type" frontend/src/lib/types.ts | head -20
```

Notiere den genauen Enum-Typ und seine Werte.

- [ ] **Step 2: AbsenceTypeDragBar erstellen**

```typescript
// frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

export const ABSENCE_TYPE_DRAG_ID_PREFIX = 'absence-type-'

export function makeAbsenceTypeDragId(absenceType: string): string {
  return `${ABSENCE_TYPE_DRAG_ID_PREFIX}${absenceType}`
}

export function parseAbsenceTypeDragId(id: string): string | null {
  if (!id.startsWith(ABSENCE_TYPE_DRAG_ID_PREFIX)) return null
  return id.slice(ABSENCE_TYPE_DRAG_ID_PREFIX.length) || null
}

// Mapping: absenceType → Kürzel + Label
const ABSENCE_TYPES: { type: string; code: string; label: string }[] = [
  { type: 'URLAUB', code: 'U', label: 'Urlaub' },
  { type: 'KRANKHEIT', code: 'K', label: 'Krankheit' },
  { type: 'FORTBILDUNG', code: 'Fo', label: 'Fortbildung' },
  { type: 'ELTERNZEIT', code: 'EZ', label: 'Elternzeit' },
  { type: 'MUTTERSCHUTZ', code: 'MuSchu', label: 'Mutterschutz' },
  { type: 'SONSTIGES', code: 'EA', label: 'Sonstiges' },
]

function AbsenceTypeChip({ absenceType, code, label }: { absenceType: string; code: string; label: string }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: makeAbsenceTypeDragId(absenceType),
    data: { absenceType, absenceCode: code, absenceLabel: label },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center justify-center min-w-[32px] h-7 px-2 rounded-md cursor-grab',
        'bg-amber-50 border border-amber-200 text-amber-800',
        'text-[11px] font-medium select-none transition-opacity',
        isDragging && 'opacity-40',
      )}
      title={label}
    >
      {code}
    </div>
  )
}

export function AbsenceTypeDragBar() {
  return (
    <div
      className="flex flex-wrap gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50/50"
      aria-label="Abwesenheits-Chips zum Ziehen"
    >
      <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wide self-center">
        Abwesenheiten
      </span>
      {ABSENCE_TYPES.map(({ type, code, label }) => (
        <AbsenceTypeChip key={type} absenceType={type} code={code} label={label} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/plans/components/AbsenceTypeDragBar.tsx
git commit -m "feat(plans): AbsenceTypeDragBar Komponente für DnD (D2)"
```

---

### Task 9: AbsenceAssignDialog Komponente (D2)

**Files:**
- Create: `frontend/src/features/plans/components/AbsenceAssignDialog.tsx`

- [ ] **Step 1: Absence-Create-Hook und API prüfen**

```bash
grep -rn "useCreateAbsence\|createAbsence\|AbsenceCreate" frontend/src/features/ | head -10
grep -n "AbsenceCreate\|AbsenceWithDetails" frontend/src/lib/types.ts | head -10
```

Falls kein `useCreateAbsence`-Hook existiert, muss er in `frontend/src/features/absences/useAbsences.ts` oder ähnlich erstellt werden. Prüfe die Absence-Feature-Struktur:

```bash
ls frontend/src/features/absences/ 2>/dev/null || ls frontend/src/features/ | grep -i absence
```

- [ ] **Step 2: useCreateAbsence Hook erstellen (falls fehlend)**

```typescript
// In der passenden Absence-Hook-Datei (oder neu erstellen):
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { planAbsenceKeys } from '@/features/plans/usePlanAbsences'
import { useHistoryStore } from '@/stores/useHistoryStore'

export function useCreateAbsence() {
  const qc = useQueryClient()
  const { push } = useHistoryStore()

  return useMutation({
    mutationFn: (data: {
      doctor_id: number
      absence_type: string
      valid_from: string
      valid_to: string
      notes?: string
    }) => apiPost<{ id: number; doctor_id: number; absence_type: string; valid_from: string; valid_to: string }>('/api/absences', data),

    onSuccess: (result, variables) => {
      // Alle Plan-Absence-Queries invalidieren (Plan-ID unbekannt hier → alles):
      void qc.invalidateQueries({ queryKey: ['plan-absences'] })
      
      push({
        type: 'CREATE_ABSENCE',
        absenceId: result.id,
        doctorId: result.doctor_id,
        absenceType: result.absence_type,
        validFrom: result.valid_from,
        validTo: result.valid_to,
        description: `Abwesenheit erstellt`,
      })
    },
  })
}
```

Passe den Query-Key-Pfad an `planAbsenceKeys` aus `usePlanAbsences.ts` an.

- [ ] **Step 3: AbsenceAssignDialog erstellen**

```typescript
// frontend/src/features/plans/components/AbsenceAssignDialog.tsx
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateAbsence } from '@/features/absences/useAbsences'  // Pfad anpassen

interface AbsenceAssignDialogProps {
  open: boolean
  onClose: () => void
  doctorId: number
  doctorName: string
  absenceType: string
  absenceLabel: string
  defaultDateFrom: string  // yyyy-MM-dd
  defaultDateTo: string
}

export function AbsenceAssignDialog({
  open,
  onClose,
  doctorId,
  doctorName,
  absenceType,
  absenceLabel,
  defaultDateFrom,
  defaultDateTo,
}: AbsenceAssignDialogProps) {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const createAbsence = useCreateAbsence()

  // Datum-State bei Dialog-Öffnung zurücksetzen:
  // (Dialog schließen + neu öffnen setzt auf Defaults)

  function handleSubmit() {
    createAbsence.mutate(
      {
        doctor_id: doctorId,
        absence_type: absenceType,
        valid_from: dateFrom,
        valid_to: dateTo,
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {absenceLabel} für {doctorName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1">
            <Label htmlFor="date-from">Von</Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="date-to">Bis</Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createAbsence.isPending || !dateFrom || !dateTo || dateFrom > dateTo}
          >
            Eintragen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/AbsenceAssignDialog.tsx
git commit -m "feat(plans): AbsenceAssignDialog Komponente (D2)"
```

---

### Task 10: ShiftTypeDragBar — Zwei-Zonen-Layout (D2)

**Files:**
- Modify: `frontend/src/features/plans/components/ShiftTypeDragBar.tsx`

- [ ] **Step 1: ShiftTypeDragBar lesen**

```bash
cat frontend/src/features/plans/components/ShiftTypeDragBar.tsx
```

Identifiziere: Wo ist der „Alle Dienste"-Button? Wo ist die äußere Wrapper-Div?

- [ ] **Step 2: AbsenceTypeDragBar importieren**

```typescript
import { AbsenceTypeDragBar } from './AbsenceTypeDragBar'
```

- [ ] **Step 3: Zwei-Zonen-Layout implementieren**

Ersetze die äußere Wrapper-Div durch zwei nebeneinander stehende Zonen:

```typescript
// Vorher: eine einzige Box
// Nachher: Flex-Row mit zwei separaten Boxen

export function ShiftTypeDragBar({ shiftTypes, focusMode, selectedIndex }: ShiftTypeDragBarProps) {
  return (
    <div className="flex gap-3" aria-label="Drag-Zonen">
      {/* Linke Zone: Dienste */}
      <div
        className="flex flex-wrap gap-2 p-3 rounded-xl border border-line bg-card flex-1"
        aria-label="Dienst-Chips"
      >
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide self-center">
          Dienste
        </span>
        {shiftTypes.map((st, idx) => {
          const isVN = st.short_name === 'V' || st.short_name === 'N'
          return (
            <ShiftTypeChip
              key={st.id}
              shiftType={st}
              dimmed={focusMode === 'vn' && !isVN}
              isSelected={selectedIndex === idx}
            />
          )
        })}
        {/* "Alle Dienste" Button — hierher verschoben: */}
        {/* Prüfe wie der Button aktuell in PlanPage o.ä. gerendert wird und verschiebe ihn hierher */}
        {/* Falls er in PlanPage ist: als Prop weitergeben oder hier fest platzieren */}
      </div>

      {/* Rechte Zone: Abwesenheiten */}
      <AbsenceTypeDragBar />
    </div>
  )
}
```

**Hinweis „Alle Dienste"-Button:** Prüfe wo dieser Button aktuell ist:
```bash
grep -rn "Alle Dienste\|alleButton\|showAll" frontend/src/features/plans/ | head -10
```

Falls er in PlanPage ist, füge ihn als zusätzliches Flex-Item in die linke Zone ein. Falls er bereits in ShiftTypeDragBar ist, verschiebe ihn ans Ende der Chip-Liste.

- [ ] **Step 4: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/ShiftTypeDragBar.tsx
git commit -m "feat(plans): ShiftTypeDragBar zweizoning (Dienste + Abwesenheiten) (D2)"
```

---

### Task 11: PlanPage — Absence-Drop-Handler (D2)

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: Imports ergänzen**

```typescript
import { parseAbsenceTypeDragId } from './components/AbsenceTypeDragBar'
import { AbsenceAssignDialog } from './components/AbsenceAssignDialog'
```

- [ ] **Step 2: State für Absence-Drop-Dialog**

```typescript
const [pendingAbsenceDrop, setPendingAbsenceDrop] = useState<{
  doctorId: number
  doctorName: string
  absenceType: string
  absenceLabel: string
  date: string
} | null>(null)
```

- [ ] **Step 3: handleDragEnd um Absence-Drop erweitern**

Finde den `handleDragEnd`-Handler in PlanPage. Füge einen neuen Zweig vor oder nach den bestehenden hinzu:

```typescript
function handleDragEnd(event: DragEndEvent) {
  setActiveDragDoctor(null)
  setDragConflictMap(null)
  const { active, over } = event

  // Neuer Zweig: Absence-Type Drop
  const absenceType = parseAbsenceTypeDragId(String(active.id))
  if (absenceType !== null && over) {
    // Drop-Ziel muss eine Zelle mit rotationId sein:
    const overStr = String(over.id)
    const cellMatch = overStr.match(/^cell-(\d+)-(\d{4}-\d{2}-\d{2})$/)
    if (cellMatch) {
      const rotationId = parseInt(cellMatch[1])
      const date = cellMatch[2]

      // doctorId aus Rotation ermitteln:
      const rotation = rotations.find(r => r.id === rotationId)
      if (rotation) {
        const doctor = doctors.find(d => d.id === rotation.doctor_id)
        const absenceLabel = absenceType  // oder aus Mapping: z.B. URLAUB → 'Urlaub'
        setPendingAbsenceDrop({
          doctorId: rotation.doctor_id,
          doctorName: doctor ? `${doctor.first_name} ${doctor.last_name}` : 'Arzt',
          absenceType,
          absenceLabel,
          date,
        })
      }
    }
    return
  }

  // Bestehende Drag-Zweige (Doctor-Drop, ShiftType-Drop) folgen hier...
}
```

**Absence-Label-Mapping:**
```typescript
// Füge diese Hilfsfunktion in PlanPage oder eine utils-Datei ein:
const ABSENCE_LABEL: Record<string, string> = {
  URLAUB: 'Urlaub',
  KRANKHEIT: 'Krankheit',
  FORTBILDUNG: 'Fortbildung',
  ELTERNZEIT: 'Elternzeit',
  MUTTERSCHUTZ: 'Mutterschutz',
  SONSTIGES: 'Sonstiges',
}
```

- [ ] **Step 4: AbsenceAssignDialog in PlanPage JSX rendern**

Innerhalb des React-Fragments (außerhalb oder neben DndContext):

```typescript
{pendingAbsenceDrop && (
  <AbsenceAssignDialog
    open={true}
    onClose={() => setPendingAbsenceDrop(null)}
    doctorId={pendingAbsenceDrop.doctorId}
    doctorName={pendingAbsenceDrop.doctorName}
    absenceType={pendingAbsenceDrop.absenceType}
    absenceLabel={pendingAbsenceDrop.absenceLabel}
    defaultDateFrom={pendingAbsenceDrop.date}
    defaultDateTo={pendingAbsenceDrop.date}
  />
)}
```

- [ ] **Step 5: AbsenceTypeDragBar in DnD-Bereich rendern**

Finde wo `ShiftTypeDragBar` in PlanPage gerendert wird und stelle sicher, dass `AbsenceTypeDragBar` innerhalb desselben `DndContext` liegt (es ist Teil von ShiftTypeDragBar nach Task 10 — kein Extra-Render nötig).

- [ ] **Step 6: TypeScript prüfen**

```bash
cd frontend && pnpm tsc --noEmit
```

- [ ] **Step 7: Frontend-Tests laufen**

```bash
cd frontend && pnpm test run
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plans): Absence-Drop-Handler in PlanPage, öffnet AbsenceAssignDialog (D2)"
```

---

## Selbstreview-Checkliste (nach Implementierung)

- [ ] Undo/Redo manuell getestet: Schicht zuweisen → Ctrl+Z entfernt sie → Ctrl+Y stellt sie wieder her
- [ ] Rotation löschen → Ctrl+Z stellt sie wieder her
- [ ] Plan-Status ändern → Ctrl+Z setzt zurück
- [ ] Undo/Redo-Buttons disabled wenn Stack leer
- [ ] Tooltips zeigen Description der letzten Aktion
- [ ] History überlebt Seiten-Neuladen (localStorage)
- [ ] Absence-Chip draggbar auf Rotationszellen
- [ ] AbsenceAssignDialog öffnet mit vorbelgtem Datum
- [ ] Erstellte Abwesenheit erscheint im Grid (U/K/Fo etc.)
- [ ] Undo eines Absence-Creates löscht die Abwesenheit
- [ ] TypeScript `pnpm tsc --noEmit` — keine Fehler
- [ ] Alle Backend-Tests `pytest -x -q` — grün
