# Plan-Frontend (M2-003) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Plan-Frontend for M2-003: Planliste, PlanGrid (Monatsansicht), Schicht-Zuweisung per Klick, Konflikt-Visualisierung per ContextPanel — alles mit echten Backend-Daten.

**Architecture:** `PlanListPage` unter `/plans` ersetzt den Platzhalter; `PlanPage` unter `/plans/:planId` enthält PlanGrid + ContextPanel. Hooks folgen dem bestehenden TanStack-Query-Muster (vgl. `useDoctors`). Datenaufbereitung für das Grid läuft in `planGridUtils.ts` (isoliert testbar). `ShiftCell` aus M1-009 wird mit einem neuen `onConflictDotClick`-Prop erweitert.

**Tech Stack:** React 18, TypeScript strict, Vite, Tailwind CSS, shadcn/ui (inkl. neuem Popover), TanStack Query v5, vitest + @testing-library/react, date-fns, sonner, lucide-react

---

## Dateistruktur

### Neu anlegen
| Datei | Zweck |
|---|---|
| `frontend/src/features/plans/PlanListPage.tsx` | Route `/plans` — Kachel-Grid |
| `frontend/src/features/plans/PlanPage.tsx` | Route `/plans/:planId` — Shell |
| `frontend/src/features/plans/components/PlanCreateDialog.tsx` | Modal, POST /api/plans |
| `frontend/src/features/plans/components/PlanGrid.tsx` | Monats-Grid (Herzstück) |
| `frontend/src/features/plans/components/DoctorAssignPopover.tsx` | Klick → PATCH |
| `frontend/src/features/plans/components/ContextPanel.tsx` | Rechtes 290px-Panel |
| `frontend/src/features/plans/components/ConflictCard.tsx` | Konflikt-Karte |
| `frontend/src/features/plans/planGridUtils.ts` | buildGridData (testbar isoliert) |
| `frontend/src/features/plans/usePlans.ts` | GET /api/plans, POST /api/plans, GET /api/plans/:id |
| `frontend/src/features/plans/usePlanShifts.ts` | GET /api/plans/:id/shifts |
| `frontend/src/features/plans/usePlanConflicts.ts` | GET /api/plans/:id/conflicts |
| `frontend/src/features/plans/useAssignShift.ts` | PATCH /api/shifts/:id |
| `frontend/src/features/plans/tests/PlanListPage.test.tsx` | Tests |
| `frontend/src/features/plans/tests/planGridUtils.test.ts` | Tests |
| `frontend/src/features/plans/tests/PlanGrid.test.tsx` | Tests |
| `frontend/src/features/plans/tests/DoctorAssignPopover.test.tsx` | Tests |
| `frontend/src/features/plans/tests/ContextPanel.test.tsx` | Tests |

### Modifizieren
| Datei | Änderung |
|---|---|
| `frontend/src/lib/types.ts` | Plan-Typen ergänzen |
| `frontend/src/App.tsx` | Route `/plans/:planId` + Import PlanListPage |
| `frontend/src/components/dp/ShiftCell.tsx` | `onConflictDotClick?` Prop ergänzen |
| `frontend/src/components/ui/popover.tsx` | shadcn installieren (neu) |

### Löschen
| Datei | Grund |
|---|---|
| `frontend/src/features/plans/PlansPage.tsx` | Wird durch PlanListPage.tsx ersetzt |

---

### Task 1: Plan-Typen in types.ts

**Files:**
- Modify: `frontend/src/lib/types.ts`

- [ ] **Schritt 1: Typen ergänzen**

Am Ende von `frontend/src/lib/types.ts` ergänzen:

```ts
export type Plan = components['schemas']['PlanResponse']
export type PlanCreate = components['schemas']['PlanCreate']
export type PlanWithRelations = components['schemas']['PlanWithRelations']
export type PlanStatus = components['schemas']['PlanStatus']
export type ShiftWithDetails = components['schemas']['ShiftWithDetails']
export type ShiftUpdate = components['schemas']['ShiftUpdate']
export type PlanConflicts = components['schemas']['PlanConflicts']
export type ShiftConflict = components['schemas']['ShiftConflict']
export type ConflictType = components['schemas']['ConflictType']
```

- [ ] **Schritt 2: TypeScript prüfen**

```
cd frontend && pnpm tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat: M2-003/1 plan types"
```

---

### Task 2: Plan-Hooks

**Files:**
- Create: `frontend/src/features/plans/usePlans.ts`
- Create: `frontend/src/features/plans/usePlanShifts.ts`
- Create: `frontend/src/features/plans/usePlanConflicts.ts`
- Create: `frontend/src/features/plans/useAssignShift.ts`

- [ ] **Schritt 1: `usePlans.ts` anlegen**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import type { Plan, PlanCreate, PlanWithRelations } from '@/lib/types'

export const planKeys = {
  all: ['plans'] as const,
  list: () => ['plans', 'list'] as const,
  detail: (id: number) => ['plans', id] as const,
}

export function usePlans() {
  return useQuery({
    queryKey: planKeys.list(),
    queryFn: () => apiGet<Plan[]>('/api/plans'),
  })
}

export function usePlan(planId: number) {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => apiGet<PlanWithRelations>(`/api/plans/${planId}`),
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PlanCreate) =>
      apiPost<PlanWithRelations>('/api/plans', data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: planKeys.all })
    },
  })
}
```

- [ ] **Schritt 2: `usePlanShifts.ts` anlegen**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { ShiftWithDetails } from '@/lib/types'

export const shiftQueryKeys = {
  byPlan: (planId: number) => ['shifts', 'plan', planId] as const,
}

export function usePlanShifts(planId: number) {
  return useQuery({
    queryKey: shiftQueryKeys.byPlan(planId),
    queryFn: () => apiGet<ShiftWithDetails[]>(`/api/plans/${planId}/shifts`),
  })
}
```

- [ ] **Schritt 3: `usePlanConflicts.ts` anlegen**

```ts
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import type { PlanConflicts } from '@/lib/types'

export const conflictQueryKeys = {
  byPlan: (planId: number) => ['conflicts', 'plan', planId] as const,
}

export function usePlanConflicts(planId: number) {
  return useQuery({
    queryKey: conflictQueryKeys.byPlan(planId),
    queryFn: () => apiGet<PlanConflicts>(`/api/plans/${planId}/conflicts`),
  })
}
```

- [ ] **Schritt 4: `useAssignShift.ts` anlegen**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api'
import type { ShiftUpdate, ShiftWithDetails } from '@/lib/types'
import { shiftQueryKeys } from './usePlanShifts'
import { conflictQueryKeys } from './usePlanConflicts'

export function useAssignShift(planId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shiftId, data }: { shiftId: number; data: ShiftUpdate }) =>
      apiPatch<ShiftWithDetails>(`/api/shifts/${shiftId}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shiftQueryKeys.byPlan(planId) })
      void qc.invalidateQueries({ queryKey: conflictQueryKeys.byPlan(planId) })
    },
  })
}
```

- [ ] **Schritt 5: TypeScript prüfen**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Schritt 6: Commit**

```bash
git add frontend/src/features/plans/usePlans.ts \
        frontend/src/features/plans/usePlanShifts.ts \
        frontend/src/features/plans/usePlanConflicts.ts \
        frontend/src/features/plans/useAssignShift.ts
git commit -m "feat: M2-003/2 plan hooks"
```

---

### Task 3: PlanCreateDialog

**Files:**
- Create: `frontend/src/features/plans/components/PlanCreateDialog.tsx`

- [ ] **Schritt 1: `PlanCreateDialog.tsx` anlegen**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getDaysInMonth } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreatePlan } from '../usePlans'

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

interface Props {
  open: boolean
  onClose: () => void
}

export function PlanCreateDialog({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { mutate, isPending } = useCreatePlan()
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [name, setName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const m = parseInt(month)
    const y = parseInt(year)
    const mm = String(m).padStart(2, '0')
    const lastDay = getDaysInMonth(new Date(y, m - 1))
    const validFrom = `${y}-${mm}-01`
    const validTo = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
    const planName = name.trim() || `${MONTHS[m - 1]} ${y}`

    mutate(
      { name: planName, valid_from: validFrom, valid_to: validTo, status: 'DRAFT' },
      {
        onSuccess: (plan) => {
          toast.success(`Plan "${planName}" erstellt`)
          onClose()
          navigate(`/plans/${plan.id}`)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen')
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Neuer Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan-month">Monat</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger id="plan-month">
                <SelectValue placeholder="Monat wählen" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-year">Jahr</Label>
            <Input
              id="plan-year"
              type="number"
              min={2020}
              max={2099}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name (optional)</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                month && year
                  ? `${MONTHS[parseInt(month) - 1]} ${year}`
                  : 'z.B. Mai 2026'
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={isPending || !month || parseInt(year) < 2020}
            >
              {isPending ? 'Erstelle…' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler

---

### Task 4: PlanListPage + Route

**Files:**
- Create: `frontend/src/features/plans/PlanListPage.tsx`
- Create: `frontend/src/features/plans/tests/PlanListPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/features/plans/PlansPage.tsx`

- [ ] **Schritt 1: Failing test schreiben**

Datei `frontend/src/features/plans/tests/PlanListPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlanListPage } from '../PlanListPage'
import type { Plan } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const mockPlans: Plan[] = [
  {
    id: 1, name: 'Mai 2026',
    valid_from: '2026-05-01', valid_to: '2026-05-31',
    status: 'DRAFT', notes: null,
    created_at: '2026-05-01T00:00:00', updated_at: '2026-05-01T00:00:00',
  },
  {
    id: 2, name: 'Juni 2026',
    valid_from: '2026-06-01', valid_to: '2026-06-30',
    status: 'RELEASED', notes: null,
    created_at: '2026-05-01T00:00:00', updated_at: '2026-05-01T00:00:00',
  },
]

vi.mock('../usePlans', () => ({
  usePlans: () => ({ data: mockPlans, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreatePlan: () => ({ mutate: vi.fn(), isPending: false }),
  usePlan: () => ({ data: undefined, isLoading: false }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks() })

describe('PlanListPage', () => {
  it('zeigt alle Pläne als Kacheln', () => {
    render(<Wrapper><PlanListPage /></Wrapper>)
    expect(screen.getByText('Mai 2026')).toBeInTheDocument()
    expect(screen.getByText('Juni 2026')).toBeInTheDocument()
  })

  it('zeigt Plan-Status unter dem Titel', () => {
    render(<Wrapper><PlanListPage /></Wrapper>)
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
    expect(screen.getByText('RELEASED')).toBeInTheDocument()
  })

  it('öffnet PlanCreateDialog bei Klick auf + Neuer Plan', async () => {
    const user = userEvent.setup()
    render(<Wrapper><PlanListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: '+ Neuer Plan' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 2: Test laufen lassen — erwartet FAIL**

```
cd frontend && pnpm test -- PlanListPage
```

Erwartet: `PlanListPage` nicht gefunden

- [ ] **Schritt 3: `PlanListPage.tsx` anlegen**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CommandBar } from '@/components/dp/CommandBar'
import { usePlans } from './usePlans'
import { PlanCreateDialog } from './components/PlanCreateDialog'
import type { Plan } from '@/lib/types'

function PlanCard({ plan, onClick }: { plan: Plan; onClick: () => void }) {
  const title = format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-line p-5 text-left hover:border-accent transition"
    >
      <p className="font-serif text-xl capitalize">{title}</p>
      <p className="text-xs text-ink-3 mt-1 uppercase tracking-wide">{plan.status}</p>
    </button>
  )
}

export function PlanListPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navigate = useNavigate()
  const { data: plans = [], isLoading, isError, refetch } = usePlans()

  return (
    <div className="flex flex-col flex-1">
      <CommandBar
        title="Pläne"
        primaryAction={{ label: '+ Neuer Plan', onClick: () => setDialogOpen(true) }}
      />
      <div className="px-10 py-6 flex-1">
        {isError && (
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm text-warn-ink">Fehler beim Laden der Pläne.</p>
            <button
              onClick={() => void refetch()}
              className="text-sm underline text-accent"
            >
              Erneut versuchen
            </button>
          </div>
        )}
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl bg-card border border-line h-28 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClick={() => navigate(`/plans/${plan.id}`)}
              />
            ))}
          </div>
        )}
      </div>
      <PlanCreateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
```

- [ ] **Schritt 4: Tests laufen lassen — erwartet PASS**

```
pnpm test -- PlanListPage
```

Erwartet: 3/3 grün

- [ ] **Schritt 5: App.tsx anpassen**

In `frontend/src/App.tsx`:

1. Alten Import entfernen:
   ```tsx
   // löschen:
   import { PlansPage } from '@/features/plans/PlansPage'
   ```

2. Neue Imports ergänzen:
   ```tsx
   import { PlanListPage } from '@/features/plans/PlanListPage'
   import { PlanPage } from '@/features/plans/PlanPage'
   ```

3. Route `/plans` tauschen und neue Route ergänzen:
   ```tsx
   <Route path="/plans" element={<PlanListPage />} />
   <Route path="/plans/:planId" element={<PlanPage />} />
   ```

- [ ] **Schritt 6: `PlansPage.tsx` löschen**

```bash
rm frontend/src/features/plans/PlansPage.tsx
```

- [ ] **Schritt 7: Alle Tests laufen**

```
pnpm test
```

Erwartet: alle grün (PlanPage als Stub anlegen falls nötig — `export function PlanPage() { return null }`)

- [ ] **Schritt 8: Commit (Stop-Gate Sub-Schritt 1)**

```bash
git add frontend/src/features/plans/ frontend/src/App.tsx
git commit -m "feat: M2-003/1 plan list page + create dialog"
```

---

### Task 5: planGridUtils (buildGridData)

**Files:**
- Create: `frontend/src/features/plans/planGridUtils.ts`
- Create: `frontend/src/features/plans/tests/planGridUtils.test.ts`

- [ ] **Schritt 1: Failing test schreiben**

Datei `frontend/src/features/plans/tests/planGridUtils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildGridData } from '../planGridUtils'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

function makeDoctor(id: number, name: string): Doctor {
  return {
    id, name, short_name: null, doctor_type: 'INTERNAL',
    is_facharzt: false, active: true, weiterbildungsjahr: null,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  }
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-01',
    shift_type_id: 1, doctor_id: null, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: ST, doctor: null, conflicts: [],
    ...overrides,
  }
}

describe('buildGridData', () => {
  it('generiert alle Tage im Zeitraum', () => {
    const { days } = buildGridData([], [], '2026-05-01', '2026-05-31')
    expect(days).toHaveLength(31)
    expect(days[0].getDate()).toBe(1)
    expect(days[30].getDate()).toBe(31)
  })

  it('erstellt eine Zeile pro Arzt', () => {
    const doctors = [makeDoctor(1, 'Müller, Anna'), makeDoctor(2, 'Schmidt, Ben')]
    const { rows } = buildGridData([], doctors, '2026-05-01', '2026-05-31')
    expect(rows).toHaveLength(2)
    expect(rows[0].doctor.id).toBe(1)
    expect(rows[1].doctor.id).toBe(2)
  })

  it('ordnet Shift dem richtigen Arzt und Tag zu', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const shift = makeShift({ id: 10, doctor_id: 1, shift_date: '2026-05-15' })
    const { rows } = buildGridData([shift], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.shifts[0].id).toBe(10)
  })

  it('setzt hasConflict wenn Shift einen Konflikt hat', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const shift = makeShift({
      id: 11, doctor_id: 1, shift_date: '2026-05-15',
      conflicts: [{
        shift_id: 11, conflict_type: 'not_available', message: 'Im Urlaub',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-15', shift_type_short_name: 'F',
      }],
    })
    const { rows } = buildGridData([shift], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.hasConflict).toBe(true)
  })

  it('lässt Cell undefined wenn kein Shift vorhanden', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const { rows } = buildGridData([], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-10']).toBeUndefined()
  })

  it('sammelt offene Schichten (doctor_id=null) in openShiftsByDay', () => {
    const shift = makeShift({ id: 20, doctor_id: null, shift_date: '2026-05-10' })
    const { openShiftsByDay } = buildGridData([shift], [], '2026-05-01', '2026-05-31')
    expect(openShiftsByDay['2026-05-10']).toHaveLength(1)
    expect(openShiftsByDay['2026-05-10'][0].id).toBe(20)
  })

  it('gruppiert mehrere Shifts eines Arztes am selben Tag', () => {
    const doctor = makeDoctor(1, 'Müller, Anna')
    const s1 = makeShift({ id: 1, doctor_id: 1, shift_date: '2026-05-15', shift_type_id: 1 })
    const s2 = makeShift({ id: 2, doctor_id: 1, shift_date: '2026-05-15', shift_type_id: 2 })
    const { rows } = buildGridData([s1, s2], [doctor], '2026-05-01', '2026-05-31')
    expect(rows[0].cells['2026-05-15']?.shifts).toHaveLength(2)
  })
})
```

- [ ] **Schritt 2: Test laufen lassen — erwartet FAIL**

```
pnpm test -- planGridUtils
```

Erwartet: `buildGridData` nicht gefunden

- [ ] **Schritt 3: `planGridUtils.ts` anlegen**

```ts
import { eachDayOfInterval, format } from 'date-fns'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

export interface GridCell {
  shifts: ShiftWithDetails[]
  hasConflict: boolean
}

export interface GridRow {
  doctor: Doctor
  cells: Record<string, GridCell>
}

export interface GridData {
  rows: GridRow[]
  days: Date[]
  openShiftsByDay: Record<string, ShiftWithDetails[]>
}

export function buildGridData(
  shifts: ShiftWithDetails[],
  doctors: Doctor[],
  validFrom: string,
  validTo: string,
): GridData {
  const days = eachDayOfInterval({
    start: new Date(validFrom),
    end: new Date(validTo),
  })

  const openShiftsByDay: Record<string, ShiftWithDetails[]> = {}
  const assignedShifts = shifts.filter((s) => {
    if (s.doctor_id === null || s.doctor_id === undefined) {
      openShiftsByDay[s.shift_date] = [
        ...(openShiftsByDay[s.shift_date] ?? []),
        s,
      ]
      return false
    }
    return true
  })

  const rows: GridRow[] = doctors.map((doctor) => {
    const cells: Record<string, GridCell> = {}
    for (const shift of assignedShifts) {
      if (shift.doctor_id !== doctor.id) continue
      const key = shift.shift_date
      if (cells[key]) {
        cells[key].shifts.push(shift)
        if (shift.conflicts.length > 0) cells[key].hasConflict = true
      } else {
        cells[key] = { shifts: [shift], hasConflict: shift.conflicts.length > 0 }
      }
    }
    return { doctor, cells }
  })

  return { rows, days, openShiftsByDay }
}
```

- [ ] **Schritt 4: Tests laufen lassen — erwartet PASS**

```
pnpm test -- planGridUtils
```

Erwartet: 7/7 grün

- [ ] **Schritt 5: Commit**

```bash
git add frontend/src/features/plans/planGridUtils.ts \
        frontend/src/features/plans/tests/planGridUtils.test.ts
git commit -m "feat: M2-003/2a grid data utility"
```

---

### Task 6: ShiftCell erweitern + PlanGrid + PlanPage-Shell

**Files:**
- Modify: `frontend/src/components/dp/ShiftCell.tsx`
- Create: `frontend/src/features/plans/components/PlanGrid.tsx`
- Create: `frontend/src/features/plans/PlanPage.tsx`
- Create: `frontend/src/features/plans/tests/PlanGrid.test.tsx`

- [ ] **Schritt 1: ShiftCell.tsx um `onConflictDotClick` erweitern**

Aktuelle Datei `frontend/src/components/dp/ShiftCell.tsx` anpassen. Der Warn-Dot bekommt einen eigenen Click-Handler mit `stopPropagation`, damit Zell-Klick und Dot-Klick unterschiedliche Aktionen auslösen können:

```tsx
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'

export function ShiftCell({
  code,
  shiftTypeId,
  conflict,
  weekend,
  today,
  onClick,
  onConflictDotClick,
}: {
  code?: string
  shiftTypeId?: number
  conflict?: boolean
  weekend?: boolean
  today?: boolean
  onClick?: () => void
  onConflictDotClick?: () => void
}) {
  if (!code) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'aspect-square w-full rounded-cell border border-dashed border-line/60 transition',
          'hover:border-ink-3/40 hover:bg-card',
          weekend && 'bg-weekend/40',
          today && 'ring-2 ring-warn-line',
        )}
      />
    )
  }
  const c = colorForShiftType({ id: shiftTypeId, code })
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-square w-full rounded-cell text-[11px] font-bold leading-none transition',
        'hover:brightness-95',
        conflict && 'ring-[1.5px] ring-warn',
        today && 'ring-2 ring-warn-line',
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {code}
      {conflict && (
        <span
          onClick={(e) => { e.stopPropagation(); onConflictDotClick?.() }}
          className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-warn text-[8px] font-bold text-paper"
        >
          !
        </span>
      )}
    </button>
  )
}
```

- [ ] **Schritt 2: Failing test schreiben**

Datei `frontend/src/features/plans/tests/PlanGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanGrid } from '../components/PlanGrid'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

const doctor: Doctor = {
  id: 1, name: 'Müller, Anna', short_name: 'AM',
  doctor_type: 'INTERNAL', is_facharzt: true,
  active: true, weiterbildungsjahr: null,
  entry_date: null, virtual_entry_date: null, notes: null,
  created_at: '', updated_at: '', employment_periods: [], qualifications: [],
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-01',
    shift_type_id: 1, doctor_id: 1, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: ST, doctor: null, conflicts: [],
    ...overrides,
  }
}

describe('PlanGrid', () => {
  it('zeigt Arztname in der linken Spalte', () => {
    render(
      <PlanGrid
        shifts={[]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('Müller, Anna')).toBeInTheDocument()
  })

  it('zeigt Schichtcode in der Zelle wenn Arzt zugewiesen', () => {
    const shift = makeShift({ doctor_id: 1, shift_date: '2026-05-01' })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('rendert Warn-Dot (!) bei Konfliktzelle', () => {
    const shift = makeShift({
      doctor_id: 1, shift_date: '2026-05-01',
      conflicts: [{
        shift_id: 1, conflict_type: 'not_available', message: 'Im Urlaub',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-01', shift_type_short_name: 'F',
      }],
    })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('!')).toBeInTheDocument()
  })

  it('ruft onCellClick mit shiftId und doctorId auf', async () => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    const shift = makeShift({ id: 42, doctor_id: 1, shift_date: '2026-05-01' })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={onCellClick} onConflictDotClick={vi.fn()}
      />
    )
    // Klick auf die Zelle (der Schiftcode-Button)
    await user.click(screen.getByText('F'))
    expect(onCellClick).toHaveBeenCalledWith(42, 1, '2026-05-01')
  })

  it('rendert Header mit Tageszahlen 1 und 31', () => {
    render(
      <PlanGrid
        shifts={[]} doctors={[]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 3: Test laufen lassen — erwartet FAIL**

```
pnpm test -- PlanGrid.test
```

Erwartet: `PlanGrid` nicht gefunden

- [ ] **Schritt 4: `PlanGrid.tsx` anlegen**

```tsx
import { format, isWeekend, isToday } from 'date-fns'
import { Avatar } from '@/components/dp/Avatar'
import { ShiftCell } from '@/components/dp/ShiftCell'
import { buildGridData } from '../planGridUtils'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

const WEEKDAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface Props {
  shifts: ShiftWithDetails[]
  doctors: Doctor[]
  validFrom: string
  validTo: string
  onCellClick: (shiftId: number | null, doctorId: number, day: string) => void
  onConflictDotClick: (shift: ShiftWithDetails) => void
}

export function PlanGrid({
  shifts, doctors, validFrom, validTo, onCellClick, onConflictDotClick,
}: Props) {
  const { rows, days } = buildGridData(shifts, doctors, validFrom, validTo)

  return (
    <div className="overflow-auto flex-1">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns: `210px repeat(${days.length}, 36px)` }}
      >
        {/* Header */}
        <div className="sticky left-0 bg-paper z-10 h-10 border-b border-line" />
        {days.map((day) => {
          const isWe = isWeekend(day)
          const isTod = isToday(day)
          const abbr = WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className={[
                'h-10 flex flex-col items-center justify-center border-b border-line',
                isWe ? 'bg-[#F3ECD8]' : '',
                isTod ? 'bg-warn-bg text-warn-ink' : '',
              ].join(' ')}
            >
              <span className="text-[10px] text-ink-3 leading-none">{abbr}</span>
              <span className="text-[16px] font-serif leading-tight">
                {format(day, 'd')}
              </span>
            </div>
          )
        })}

        {/* Rows */}
        {rows.map(({ doctor, cells }) => (
          <>
            <div
              key={`lbl-${doctor.id}`}
              className="sticky left-0 bg-paper z-10 flex items-center gap-2 px-2 h-[42px] border-b border-line/50"
            >
              <Avatar name={doctor.name} id={doctor.id} size={26} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-tight truncate">
                  {doctor.name}
                </p>
                <p className="text-[10px] text-ink-3 leading-none">
                  {doctor.is_facharzt
                    ? 'Facharzt'
                    : `WBJ ${doctor.weiterbildungsjahr ?? '–'}`}
                </p>
              </div>
            </div>

            {days.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const cell = cells[dayKey]
              const firstShift = cell?.shifts[0]
              return (
                <div
                  key={`cell-${doctor.id}-${dayKey}`}
                  className={[
                    'h-[42px] flex items-center justify-center p-0.5 border-b border-line/30',
                    isWeekend(day) ? 'bg-[#F3ECD8]/40' : '',
                  ].join(' ')}
                >
                  <ShiftCell
                    code={firstShift?.shift_type?.short_name}
                    shiftTypeId={firstShift?.shift_type_id}
                    conflict={cell?.hasConflict}
                    weekend={isWeekend(day)}
                    today={isToday(day)}
                    onClick={() => onCellClick(firstShift?.id ?? null, doctor.id, dayKey)}
                    onConflictDotClick={
                      firstShift && cell?.hasConflict
                        ? () => onConflictDotClick(firstShift)
                        : undefined
                    }
                  />
                </div>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 5: `PlanPage.tsx` anlegen**

```tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CommandBar } from '@/components/dp/CommandBar'
import { KpiBar } from '@/components/dp/KpiBar'
import { usePlan } from './usePlans'
import { usePlanShifts } from './usePlanShifts'
import { usePlanConflicts } from './usePlanConflicts'
import { useDoctors } from '@/features/doctors/useDoctors'
import { PlanGrid } from './components/PlanGrid'
import { ContextPanel } from './components/ContextPanel'
import { DoctorAssignPopover } from './components/DoctorAssignPopover'
import type { ShiftWithDetails } from '@/lib/types'

interface ActiveCell {
  shiftId: number | null
  doctorId: number
  day: string
}

export function PlanPage() {
  const { planId } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const id = Number(planId)

  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)
  const [contextShift, setContextShift] = useState<ShiftWithDetails | null>(null)

  const { data: plan } = usePlan(id)
  const { data: shifts = [], isError: shiftsError } = usePlanShifts(id)
  const { data: conflicts } = usePlanConflicts(id)
  const { data: doctors = [] } = useDoctors()

  useEffect(() => {
    if (shiftsError) {
      toast.error('Plan nicht gefunden')
      navigate('/plans')
    }
  }, [shiftsError, navigate])

  const planTitle = plan
    ? format(new Date(plan.valid_from), 'MMMM yyyy', { locale: de })
    : '…'

  const kpiTiles = [
    { label: 'Ärzte', value: doctors.length },
    { label: 'Schichten', value: shifts.length },
    {
      label: 'Offen',
      value: conflicts?.open_shift_count ?? 0,
      tone: (conflicts?.open_shift_count ?? 0) > 0
        ? ('warn' as const)
        : ('default' as const),
    },
    {
      label: 'Konflikte',
      value: conflicts?.conflict_count ?? 0,
      tone: (conflicts?.conflict_count ?? 0) > 0
        ? ('warn' as const)
        : ('default' as const),
    },
  ]

  function handleCellClick(shiftId: number | null, doctorId: number, day: string) {
    setContextShift(null)
    setActiveCell({ shiftId, doctorId, day })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <CommandBar
        title={planTitle}
        breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
      />
      <div className="px-6 py-3">
        <KpiBar tiles={kpiTiles} />
      </div>
      <div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        {plan && (
          <PlanGrid
            shifts={shifts}
            doctors={doctors}
            validFrom={plan.valid_from}
            validTo={plan.valid_to}
            onCellClick={handleCellClick}
            onConflictDotClick={(shift) => {
              setActiveCell(null)
              setContextShift(shift)
            }}
          />
        )}
        {contextShift && (
          <ContextPanel
            shift={contextShift}
            onClose={() => setContextShift(null)}
          />
        )}
      </div>
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
          onClose={() => setActiveCell(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Schritt 6: Tests laufen lassen — erwartet PASS**

```
pnpm test -- PlanGrid.test
```

Erwartet: 5/5 grün

- [ ] **Schritt 7: Alle Tests**

```
pnpm test
```

Erwartet: alle grün

- [ ] **Schritt 8: Commit (Stop-Gate Sub-Schritt 2)**

```bash
git add frontend/src/features/plans/ frontend/src/components/dp/ShiftCell.tsx
git commit -m "feat: M2-003/2 plan grid + plan page shell"
```

---

### Task 7: DoctorAssignPopover

**Files:**
- Create: `frontend/src/components/ui/popover.tsx` (shadcn installieren)
- Create: `frontend/src/features/plans/components/DoctorAssignPopover.tsx`
- Create: `frontend/src/features/plans/tests/DoctorAssignPopover.test.tsx`

- [ ] **Schritt 1: shadcn Popover installieren**

```bash
cd frontend && pnpm dlx shadcn@latest add popover
```

Erwartet: `frontend/src/components/ui/popover.tsx` wird angelegt.

- [ ] **Schritt 2: Failing test schreiben**

Datei `frontend/src/features/plans/tests/DoctorAssignPopover.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DoctorAssignPopover } from '../components/DoctorAssignPopover'
import type { Doctor, ShiftWithDetails } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockDoctors: Doctor[] = [
  {
    id: 1, name: 'Müller, Anna', short_name: 'AM',
    doctor_type: 'INTERNAL', is_facharzt: true,
    active: true, weiterbildungsjahr: null,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  },
]

const mockMutate = vi.fn()

vi.mock('@/features/doctors/useDoctors', () => ({
  useDoctors: () => ({ data: mockDoctors, isLoading: false }),
}))

vi.mock('../useAssignShift', () => ({
  useAssignShift: () => ({ mutate: mockMutate, isPending: false }),
}))

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

function makeOpenShift(id: number, shortName: string): ShiftWithDetails {
  return {
    id, plan_id: 1, shift_date: '2026-05-15',
    shift_type_id: id, doctor_id: null, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: { ...ST, id, name: shortName, short_name: shortName },
    doctor: null, conflicts: [],
  }
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => { vi.clearAllMocks() })

describe('DoctorAssignPopover', () => {
  it('zeigt offene Schichttypen zur Auswahl', () => {
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null}
          openShiftsForDay={[makeOpenShift(1, 'F'), makeOpenShift(2, 'N')]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  it('ruft PATCH mit doctor_id auf beim Zuweisen', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null}
          openShiftsForDay={[makeOpenShift(1, 'F')]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    await user.click(screen.getByText('F'))
    expect(mockMutate).toHaveBeenCalledWith(
      { shiftId: 1, data: { doctor_id: 1 } },
      expect.anything(),
    )
  })

  it('zeigt "Zuweisung entfernen" bei besetzter Zelle', () => {
    const occupied: ShiftWithDetails = { ...makeOpenShift(1, 'F'), doctor_id: 1 }
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={occupied}
          openShiftsForDay={[]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    expect(screen.getByText(/Zuweisung entfernen/)).toBeInTheDocument()
  })

  it('ruft PATCH mit doctor_id=null beim Entfernen auf', async () => {
    const user = userEvent.setup()
    const occupied: ShiftWithDetails = { ...makeOpenShift(1, 'F'), doctor_id: 1 }
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={occupied}
          openShiftsForDay={[]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    await user.click(screen.getByText(/Zuweisung entfernen/))
    expect(mockMutate).toHaveBeenCalledWith(
      { shiftId: 1, data: { doctor_id: null } },
      expect.anything(),
    )
  })

  it('schließt bei Klick außerhalb', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null} openShiftsForDay={[]}
          onClose={onClose}
        />
      </Wrapper>
    )
    await user.click(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Schritt 3: Test laufen lassen — erwartet FAIL**

```
pnpm test -- DoctorAssignPopover
```

Erwartet: Komponente nicht gefunden

- [ ] **Schritt 4: `DoctorAssignPopover.tsx` anlegen**

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAssignShift } from '../useAssignShift'
import { useDoctors } from '@/features/doctors/useDoctors'
import type { ShiftWithDetails } from '@/lib/types'

interface Props {
  planId: number
  doctorId: number
  day: string
  currentShift: ShiftWithDetails | null
  openShiftsForDay: ShiftWithDetails[]
  onClose: () => void
}

export function DoctorAssignPopover({
  planId, doctorId, currentShift, openShiftsForDay, onClose,
}: Props) {
  const { mutate, isPending } = useAssignShift(planId)
  const { data: doctors = [] } = useDoctors()
  const [search, setSearch] = useState('')

  function assign(shiftId: number, newDoctorId: number | null) {
    mutate(
      { shiftId, data: { doctor_id: newDoctorId } },
      {
        onSuccess: () => {
          toast.success(newDoctorId ? 'Zuweisung gespeichert' : 'Zuweisung entfernt')
          onClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern')
        },
      },
    )
  }

  const filteredDoctors = doctors.filter(
    (d) => d.active && d.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-2xl shadow-lg w-72 p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Offene Schichten */}
        {openShiftsForDay.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3 font-medium">Schicht auswählen</p>
            <div className="flex flex-wrap gap-1.5">
              {openShiftsForDay.map((s) => (
                <button
                  key={s.id}
                  disabled={isPending}
                  onClick={() => assign(s.id, doctorId)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold bg-paper border border-line hover:border-accent transition"
                >
                  {s.shift_type?.short_name ?? s.shift_type_id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anderen Arzt zuweisen (nur bei besetzter Zelle) */}
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
              {filteredDoctors.map((d) => (
                <li key={d.id}>
                  <button
                    disabled={isPending}
                    onClick={() => assign(currentShift.id, d.id)}
                    className="w-full text-left px-2 py-1 rounded-md text-xs hover:bg-paper transition"
                  >
                    {d.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Zuweisung entfernen */}
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
      </div>
    </div>
  )
}
```

- [ ] **Schritt 5: Tests laufen lassen — erwartet PASS**

```
pnpm test -- DoctorAssignPopover
```

Erwartet: 5/5 grün

- [ ] **Schritt 6: Alle Tests**

```
pnpm test
```

Erwartet: alle grün

- [ ] **Schritt 7: Commit (Stop-Gate Sub-Schritt 3)**

```bash
git add frontend/src/features/plans/ frontend/src/components/ui/popover.tsx
git commit -m "feat: M2-003/3 doctor assign popover"
```

---

### Task 8: ConflictCard + ContextPanel

**Files:**
- Create: `frontend/src/features/plans/components/ConflictCard.tsx`
- Create: `frontend/src/features/plans/components/ContextPanel.tsx`
- Create: `frontend/src/features/plans/tests/ContextPanel.test.tsx`

- [ ] **Schritt 1: Failing test schreiben**

Datei `frontend/src/features/plans/tests/ContextPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextPanel } from '../components/ContextPanel'
import type { ShiftWithDetails } from '@/lib/types'

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

function makeShiftWithConflicts(): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-15',
    shift_type_id: 1, doctor_id: 1, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: ST,
    doctor: {
      id: 1, name: 'Müller, Anna', short_name: 'AM',
      doctor_type: 'INTERNAL', is_facharzt: true,
      active: true, weiterbildungsjahr: null,
      entry_date: null, virtual_entry_date: null, notes: null,
      created_at: '', updated_at: '',
    },
    conflicts: [
      {
        shift_id: 1, conflict_type: 'not_available',
        message: 'Arzt hat Urlaub an diesem Tag.',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-15', shift_type_short_name: 'F',
      },
      {
        shift_id: 1, conflict_type: 'double_booked',
        message: 'Mehrfachzuweisung am 15.05.',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-15', shift_type_short_name: 'F',
      },
    ],
  }
}

describe('ContextPanel', () => {
  it('zeigt alle Konflikt-Nachrichten', () => {
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={vi.fn()} />)
    expect(screen.getByText('Arzt hat Urlaub an diesem Tag.')).toBeInTheDocument()
    expect(screen.getByText('Mehrfachzuweisung am 15.05.')).toBeInTheDocument()
  })

  it('zeigt Konflikttyp-Badge für jeden Konflikt', () => {
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={vi.fn()} />)
    expect(screen.getByText('NOT_AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('DOUBLE_BOOKED')).toBeInTheDocument()
  })

  it('ruft onClose bei ×-Klick auf', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /schließen/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Schritt 2: Test laufen lassen — erwartet FAIL**

```
pnpm test -- ContextPanel
```

Erwartet: Komponenten nicht gefunden

- [ ] **Schritt 3: `ConflictCard.tsx` anlegen**

```tsx
import type { ShiftConflict } from '@/lib/types'

const CONFLICT_LABELS: Record<string, string> = {
  not_available: 'NOT_AVAILABLE',
  double_booked: 'DOUBLE_BOOKED',
}

export function ConflictCard({ conflict }: { conflict: ShiftConflict }) {
  return (
    <div className="rounded-xl border border-warn-line bg-warn-bg p-3 space-y-1.5">
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-warn text-paper">
        {CONFLICT_LABELS[conflict.conflict_type] ?? conflict.conflict_type}
      </span>
      <p className="text-xs text-warn-ink leading-snug">{conflict.message}</p>
      <p className="text-[10px] text-ink-3">
        {conflict.doctor_name} · {conflict.shift_date} · {conflict.shift_type_short_name}
      </p>
    </div>
  )
}
```

- [ ] **Schritt 4: `ContextPanel.tsx` anlegen**

```tsx
import { X } from 'lucide-react'
import { ConflictCard } from './ConflictCard'
import type { ShiftWithDetails } from '@/lib/types'

interface Props {
  shift: ShiftWithDetails
  onClose: () => void
}

export function ContextPanel({ shift, onClose }: Props) {
  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-card border border-line rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="text-sm font-medium">
          {shift.shift_type?.short_name} · {shift.shift_date}
        </p>
        <button
          aria-label="Schließen"
          onClick={onClose}
          className="text-ink-3 hover:text-ink transition"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {shift.conflicts.map((conflict, i) => (
          <ConflictCard key={i} conflict={conflict} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Schritt 5: Tests laufen lassen — erwartet PASS**

```
pnpm test -- ContextPanel
```

Erwartet: 3/3 grün

- [ ] **Schritt 6: Alle Tests**

```
pnpm test
```

Erwartet: alle grün

- [ ] **Schritt 7: Commit (Stop-Gate Sub-Schritt 4)**

```bash
git add frontend/src/features/plans/
git commit -m "feat: M2-003/4 context panel + conflict cards"
```

---

### Task 9: ADRs + Task-Briefing anlegen

**Files:**
- Modify: `docs/decisions.md`
- Create: `tasks/open/M2-003-plan-frontend.md`

- [ ] **Schritt 1: ADRs in `docs/decisions.md` ergänzen**

Am Ende von `docs/decisions.md` hinzufügen:

```markdown
## ADR-040: PlanGrid — Zeilen sind Ärzte, Spalten sind Tage

Zeilen = aktive Ärzte (aus GET /api/doctors). Spalten = Kalendertage des Plans.
Zellen zeigen den Schichttyp-Code der zugewiesenen Shifts dieses Arztes an diesem Tag.
Unbesetzte Shifts tauchen in keiner Arzt-Zeile auf; sie sind über `open_shift_count` (KpiBar)
und das DoctorAssignPopover zugänglich.
Begründung: Planungskoordinatoren denken arzt-zentriert.

## ADR-041: ContextPanel öffnet per Warn-Dot, DoctorAssignPopover per Zell-Klick

Warn-Dot (11×11 px, oben rechts) öffnet ContextPanel mit Konflikt-Details.
Klick auf den Rest der Zelle öffnet DoctorAssignPopover für Zuweisungsänderungen.
ShiftCell.onConflictDotClick stoppt Propagation damit beide Handler unabhängig sind.

## ADR-042: Nur Monatsansicht in M2-003

14-Tage- und 1-Tages-Views wurden bewusst zurückgestellt.
Pläne decken einen Kalendermonat ab; die Monatsansicht ist die primäre Nutzeranforderung.
Views können in einem späteren Meilenstein additiv ergänzt werden.

## ADR-043: useAssignShift ohne optimistic update

PATCH-Response enthält bewusst keine Konflikte (ADR aus M2-005). Invalidierung beider
Queries (shifts + conflicts) nach onSuccess ist ausreichend für eine lokale SQLite-App.
```

- [ ] **Schritt 2: Task-Briefing anlegen**

Datei `tasks/open/M2-003-plan-frontend.md` anlegen mit folgendem Inhalt:

```markdown
# Task M2-003: Plan-Frontend

## Ziel
Die erste vollständige Plan-Ansicht: Planliste, PlanGrid (Monatsansicht),
Schicht-Zuweisung per Klick, Konflikt-Visualisierung per ContextPanel.

## Implementierungsplan
docs/superpowers/plans/2026-05-18-m2-003-plan-frontend.md

## Kontext
Lies vor Beginn:
1. CLAUDE.md
2. docs/superpowers/specs/2026-05-18-m2-003-plan-frontend-design.md
3. docs/superpowers/plans/2026-05-18-m2-003-plan-frontend.md (dieser Plan)
4. frontend/src/lib/api-types.ts (Plan*, Shift*, Conflict*-Typen)
5. frontend/src/components/dp/ShiftCell.tsx (wird erweitert)
6. frontend/src/features/doctors/useDoctors.ts (Hook-Muster)
7. frontend/src/features/plans/PlansPage.tsx (Platzhalter, wird ersetzt)
8. frontend/src/App.tsx (Routing)
```

- [ ] **Schritt 3: Commit**

```bash
git add docs/decisions.md tasks/open/M2-003-plan-frontend.md \
        docs/superpowers/plans/2026-05-18-m2-003-plan-frontend.md
git commit -m "docs: M2-003 ADRs, task briefing, implementation plan"
```

---

### Task 10: Finaler Test-Run + Merge

- [ ] **Schritt 1: Alle Tests laufen lassen**

```
cd frontend && pnpm test
```

Erwartet: alle grün, keine Fehler

- [ ] **Schritt 2: TypeScript prüfen**

```
pnpm tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Schritt 3: Merge nach main**

```bash
git checkout main
git merge task/M2-003-plan-frontend
git push origin main
```

- [ ] **Schritt 4: Task archivieren**

```bash
mv tasks/open/M2-003-plan-frontend.md tasks/done/
git add tasks/
git commit -m "chore: archive M2-003"
git push
```
