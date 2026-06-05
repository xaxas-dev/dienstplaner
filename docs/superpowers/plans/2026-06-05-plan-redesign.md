# PlanPage Redesign (A2 · Besetzungsplanung + INA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the A2 Besetzungsplanung design spec — new PlanCommandBar, new PlanKpiBar, grid header restyling, and always-visible doctor ContextPanel.

**Architecture:** Five targeted changes — two new leaf components (PlanCommandBar, PlanKpiBar), one redesigned component (ContextPanel, now always-visible with doctor context), targeted class changes in UnifiedPlanGrid header, and wiring changes in PlanPage. No backend changes, no new routes, no new Tailwind tokens. DnD/data-flow logic untouched.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (existing tokens), Vitest, date-fns

---

## Tailwind token reference (existing — no new tokens needed)

```
font-serif       → Newsreader (already mapped in tailwind.config)
rounded-cell     → 7px
bg-paper         → #F6F1E6
bg-card          → #FFFCF5
bg-weekend       → #F3ECD8
bg-today         → #FAF0DC
bg-warn-bg       → #FBE5D6
text-warn-ink    → #7A3414
border-warn-line → #F0C3A2
text-warn        → #B85B22
text-dp-accent   → #C66A3D (use `text-dp-accent` or `bg-dp-accent`)
bg-dp-accent-2   → #E69E66 (for sparkline bars)
text-ink         → #26221C
text-ink-2       → #5C544A
text-ink-3       → #8A8275
border-line      → #E8E0CF
border-line-2    → #D6CCB6
```

Header bg `#FAF5E9` has no token — use Tailwind arbitrary value `bg-[#FAF5E9]`.

---

## File Map

| Action | Path |
|---|---|
| Create | `frontend/src/features/plans/components/PlanCommandBar.tsx` |
| Create | `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx` |
| Create | `frontend/src/features/plans/components/PlanKpiBar.tsx` |
| Create | `frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx` |
| Modify | `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` (lines 298–322) |
| Modify | `frontend/src/features/plans/components/ContextPanel.tsx` |
| Modify | `frontend/src/features/plans/PlanPage.tsx` |

---

### Task 1: PlanCommandBar

**Files:**
- Create: `frontend/src/features/plans/components/PlanCommandBar.tsx`
- Create: `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { PlanCommandBar } from '../PlanCommandBar'

vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const base = {
  planMonth: 'Mai',
  planYear: '2026',
  kwRange: '19–20',
  rotationCount: 8,
  conflictCount: 0,
  prevPlan: null,
  nextPlan: null,
  solverEnabled: false,
  isSolving: false,
  onNavigatePrev: vi.fn(),
  onNavigateNext: vi.fn(),
  onSolve: vi.fn(),
  onExport: vi.fn(),
  onScrollToConflict: vi.fn(),
  onOpenCommandPalette: vi.fn(),
}

test('renders month and year', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByText('Mai')).toBeInTheDocument()
  expect(screen.getByText('2026')).toBeInTheDocument()
})

test('shows conflict chip when conflictCount > 0', () => {
  render(<PlanCommandBar {...base} conflictCount={3} />)
  expect(screen.getByText('3 Konflikte')).toBeInTheDocument()
})

test('hides conflict chip when conflictCount is 0', () => {
  render(<PlanCommandBar {...base} conflictCount={0} />)
  expect(screen.queryByText(/Konflikte/)).not.toBeInTheDocument()
})

test('shows Exportieren when solverEnabled false', () => {
  render(<PlanCommandBar {...base} solverEnabled={false} />)
  expect(screen.getByRole('button', { name: 'Exportieren' })).toBeInTheDocument()
})

test('shows Plan generieren when solverEnabled true', () => {
  render(<PlanCommandBar {...base} solverEnabled={true} />)
  expect(screen.getByRole('button', { name: 'Plan generieren' })).toBeInTheDocument()
})

test('prev button disabled when prevPlan null', () => {
  render(<PlanCommandBar {...base} prevPlan={null} />)
  expect(screen.getByLabelText('Vorheriger Plan')).toBeDisabled()
})
```

- [ ] **Step 2: Run test — confirm FAIL**

```
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanCommandBar.test.tsx
```
Expected: FAIL with `Cannot find module '../PlanCommandBar'`

- [ ] **Step 3: Implement PlanCommandBar**

```tsx
// frontend/src/features/plans/components/PlanCommandBar.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PlanCommandBarProps {
  planMonth: string
  planYear: string
  kwRange: string
  rotationCount: number
  conflictCount: number
  prevPlan: { id: number; valid_from: string } | null
  nextPlan: { id: number; valid_from: string } | null
  solverEnabled: boolean
  isSolving: boolean
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onSolve: () => void
  onExport: () => void
  onScrollToConflict: () => void
  onOpenCommandPalette: () => void
}

export function PlanCommandBar({
  planMonth,
  planYear,
  kwRange,
  rotationCount,
  conflictCount,
  prevPlan,
  nextPlan,
  solverEnabled,
  isSolving,
  onNavigatePrev,
  onNavigateNext,
  onSolve,
  onExport,
  onScrollToConflict,
  onOpenCommandPalette,
}: PlanCommandBarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3.5 border-b border-line bg-paper flex-wrap shrink-0">
      {/* Titel */}
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-2xl tracking-tight leading-none">
          <span className="italic text-dp-accent">{planMonth}</span>
          {' '}
          <span className="text-ink">{planYear}</span>
        </span>
        <span className="text-[13px] text-ink-3">· KW {kwRange} · {rotationCount} Ärzte</span>
      </div>

      {/* Prev / Next */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNavigatePrev}
          disabled={!prevPlan}
          aria-label="Vorheriger Plan"
          className="w-7 h-7 rounded-[8px] bg-card border border-line text-ink-2 flex items-center justify-center hover:bg-paper disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onNavigateNext}
          disabled={!nextPlan}
          aria-label="Nächster Plan"
          className="w-7 h-7 rounded-[8px] bg-card border border-line text-ink-2 flex items-center justify-center hover:bg-paper disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="w-px h-[22px] bg-line mx-1 shrink-0" />

      {/* Filter-Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] font-medium bg-ink text-[#FBF6E8] border border-ink select-none">
          2 Wochen
        </span>
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] bg-card text-ink-2 border border-line-2 select-none">
          Alle Stationen
        </span>
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] bg-card text-ink-2 border border-line-2 select-none">
          Alle Schichten
        </span>
        {conflictCount > 0 && (
          <button
            type="button"
            onClick={onScrollToConflict}
            className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] font-medium bg-warn-bg text-warn-ink border border-warn-line hover:opacity-80 transition-opacity"
          >
            {conflictCount} Konflikte
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Suche */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2 min-w-[200px] px-3 py-1.5 border border-line-2 rounded-full bg-card text-[13px] text-ink-3 hover:bg-paper transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Suchen oder Befehl …</span>
        <span className="font-mono text-[11px]">⌘K</span>
      </button>

      {/* Primäraktion */}
      {solverEnabled ? (
        <button
          type="button"
          onClick={onSolve}
          disabled={isSolving}
          aria-label="Plan generieren"
          className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
        >
          {isSolving ? 'Berechne…' : 'Plan generieren'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onExport}
          aria-label="Exportieren"
          className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors"
        >
          Exportieren
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanCommandBar.test.tsx
```
Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanCommandBar.tsx frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx
git commit -m "feat(redesign): PlanCommandBar — plan-specific top command bar"
```

---

### Task 2: PlanKpiBar

**Files:**
- Create: `frontend/src/features/plans/components/PlanKpiBar.tsx`
- Create: `frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx
import { render, screen } from '@testing-library/react'
import { PlanKpiBar } from '../PlanKpiBar'
import type { ShiftWithDetails } from '@/lib/types'

const noShifts: ShiftWithDetails[] = []

const twoShifts: ShiftWithDetails[] = [
  { id: 1, doctor_id: 1, shift_date: '2026-05-04', conflicts: [], shift_type: null, is_pinned: false, is_locked: false, note: null } as unknown as ShiftWithDetails,
  { id: 2, doctor_id: null, shift_date: '2026-05-05', conflicts: [], shift_type: null, is_pinned: false, is_locked: false, note: null } as unknown as ShiftWithDetails,
]

test('renders Abdeckung label', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('Abdeckung')).toBeInTheDocument()
})

test('shows 0% when no shifts', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('0%')).toBeInTheDocument()
})

test('shows 50% when half assigned', () => {
  render(<PlanKpiBar shifts={twoShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={1} conflictCount={0} />)
  expect(screen.getByText('50%')).toBeInTheDocument()
})

test('shows offen count', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={4} conflictCount={0} />)
  expect(screen.getByText('4')).toBeInTheDocument()
  expect(screen.getByText('offen')).toBeInTheDocument()
})

test('shows Plan tab as active', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('Plan')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — confirm FAIL**

```
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanKpiBar.test.tsx
```
Expected: FAIL with `Cannot find module '../PlanKpiBar'`

- [ ] **Step 3: Implement PlanKpiBar**

```tsx
// frontend/src/features/plans/components/PlanKpiBar.tsx
import { useMemo } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { ShiftWithDetails } from '@/lib/types'

export interface PlanKpiBarProps {
  shifts: ShiftWithDetails[]
  planFrom: string
  planTo: string
  openCount: number
  conflictCount: number
}

export function PlanKpiBar({ shifts, planFrom, planTo, openCount, conflictCount }: PlanKpiBarProps) {
  const coverage = useMemo(() => {
    if (shifts.length === 0) return 0
    return Math.round(shifts.filter((s) => s.doctor_id != null).length / shifts.length * 100)
  }, [shifts])

  const sparkline = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: parseISO(planFrom), end: parseISO(planTo) }).slice(0, 14)
      return days.map((day) => {
        const dk = format(day, 'yyyy-MM-dd')
        const dayShifts = shifts.filter((s) => s.shift_date === dk)
        if (dayShifts.length === 0) return 0
        return Math.round(dayShifts.filter((s) => s.doctor_id != null).length / dayShifts.length * 100)
      })
    } catch {
      return []
    }
  }, [shifts, planFrom, planTo])

  const today = format(new Date(), 'yyyy-MM-dd')
  const shiftsToday = shifts.filter((s) => s.shift_date === today && s.doctor_id != null).length

  return (
    <div className="flex items-center gap-6 px-6 py-2.5 border-b border-line bg-card text-[12px] text-ink-2 shrink-0 flex-wrap">
      {/* Abdeckung + Sparkline */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-[22px] text-ink tabular-nums leading-none">{coverage}%</span>
          <span>Abdeckung</span>
        </div>
        {sparkline.length > 0 && (
          <div className="flex items-end gap-0.5 h-[22px]">
            {sparkline.map((v, i) => (
              <div
                key={i}
                className={cn('w-[5px] rounded-sm', v < 80 ? 'bg-warn' : 'bg-dp-accent-2')}
                style={{ height: `${Math.max(4, (v / 100) * 22)}px` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-[18px] bg-line shrink-0" />

      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[18px] text-ink tabular-nums leading-none">{openCount}</span>
        <span>offen</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-serif text-[18px] tabular-nums leading-none', conflictCount > 0 ? 'text-warn' : 'text-ink')}>
          {conflictCount}
        </span>
        <span>Konflikte</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-[18px] text-ink tabular-nums leading-none">{shiftsToday}</span>
        <span>heute im Dienst</span>
      </div>

      <div className="flex-1" />

      {/* View-Tabs (dekorativ) */}
      <div className="flex items-center gap-0.5">
        {(['Plan', 'Wunsch', 'Konflikte', 'Bilanz'] as const).map((tab) => (
          <span
            key={tab}
            className={cn(
              'px-3 py-[5px] rounded-full text-[12px] select-none',
              tab === 'Plan'
                ? 'bg-warn-bg text-warn-ink border border-warn-line font-medium'
                : 'text-ink-3',
            )}
          >
            {tab}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm PASS**

```
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanKpiBar.test.tsx
```
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanKpiBar.tsx frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx
git commit -m "feat(redesign): PlanKpiBar — coverage sparkline + KPI tiles + view tabs"
```

---

### Task 3: Wire PlanCommandBar + PlanKpiBar into PlanPage

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: Add imports**

In PlanPage.tsx, add to the import block:
```tsx
import { PlanCommandBar } from './components/PlanCommandBar'
import { PlanKpiBar } from './components/PlanKpiBar'
import { useCommandPalette } from '@/features/command-palette/useCommandPalette'
```

- [ ] **Step 2: Add hook + derived values at top of PlanPage()**

After `const planTitle = ...` (around line 394), add:
```tsx
const { open: openCommandPalette } = useCommandPalette()

const planMonth = plan
  ? format(new Date(plan.valid_from), 'MMMM', { locale: de })
  : ''
const planYear = plan
  ? format(new Date(plan.valid_from), 'yyyy')
  : ''
const kwRange = useMemo(() => {
  if (!plan) return ''
  const kwFrom = format(parseISO(plan.valid_from), 'I', { locale: de })
  const kwTo = format(parseISO(plan.valid_to), 'I', { locale: de })
  return kwFrom === kwTo ? kwFrom : `${kwFrom}–${kwTo}`
}, [plan])
```

- [ ] **Step 3: Replace CommandBar in JSX**

Find and replace the `<CommandBar ... />` block (starts around line 755):

**Before (entire CommandBar block):**
```tsx
<CommandBar
  title={planTitle}
  titleNode={
    <span className="inline-flex items-center gap-0.5">
      <button ... ><ChevronLeft .../></button>
      <span>{planTitle}</span>
      <button ... ><ChevronRight .../></button>
    </span>
  }
  breadcrumb={[{ label: 'Pläne', href: '/plans' }]}
  primaryAction={...}
  extras={plan ? (<div className="flex items-center gap-2">...</div>) : undefined}
/>
```

**After:**
```tsx
<PlanCommandBar
  planMonth={planMonth}
  planYear={planYear}
  kwRange={kwRange}
  rotationCount={rotations.length}
  conflictCount={conflictCount}
  openCount={openCount}
  prevPlan={prevPlan}
  nextPlan={nextPlan}
  solverEnabled={solverEnabled}
  isSolving={solvePlan.isPending}
  onNavigatePrev={() => prevPlan && navigate(`/plans/${planToSlug(prevPlan)}`)}
  onNavigateNext={() => nextPlan && navigate(`/plans/${planToSlug(nextPlan)}`)}
  onSolve={handleSolve}
  onExport={() => !isNaN(id) && window.location.assign(`/api/plans/${id}/export`)}
  onScrollToConflict={() => scrollToFirstMatch('conflict')}
  onOpenCommandPalette={openCommandPalette}
/>
{plan && (
  <div className="flex items-center gap-2 px-6 py-1.5 border-b border-line bg-paper shrink-0">
    <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
      <Settings size={14} className="mr-1.5" />
      Einstellungen
    </Button>
    <Button variant="outline" size="sm" onClick={() => setLockedWeekDialogOpen(true)} className="shrink-0">
      <MoonStar className="size-4 mr-1.5" />
      Nachtwoche
    </Button>
    {solverEnabled && (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSolve}
        disabled={solvePlan.isPending || isNaN(id)}
      >
        <Zap className="size-3.5 mr-1.5" />
        {solvePlan.isPending ? 'Berechne…' : 'Solver'}
      </Button>
    )}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={updatePlan.isPending} className="min-w-[110px] gap-1.5">
          <span className={cn(
            'size-1.5 rounded-full shrink-0',
            plan.status === 'RELEASED' ? 'bg-green-500'
            : plan.status === 'ARCHIVED' ? 'bg-amber-400'
            : 'bg-gray-400'
          )} />
          {statusLabel}
          <ChevronDown className="size-3.5 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {plan.status !== 'RELEASED' && (
          <DropdownMenuItem onClick={() => handleStatusChange('RELEASED')}>Freigeben</DropdownMenuItem>
        )}
        {plan.status !== 'ARCHIVED' && (
          <DropdownMenuItem onClick={() => handleStatusChange('ARCHIVED')}>Archivieren</DropdownMenuItem>
        )}
        {plan.status !== 'DRAFT' && (
          <DropdownMenuItem onClick={() => handleStatusChange('DRAFT')}>Zurück zu Entwurf</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowDeleteDialog(true)}
      className="text-red-500 hover:text-red-700 hover:bg-red-50"
      aria-label="Plan löschen"
    >
      <Trash2 className="size-4" />
    </Button>
  </div>
)}
```

- [ ] **Step 4: Replace KpiBar in JSX**

Find and remove:
```tsx
<div className="px-6 py-3">
  <KpiBar tiles={kpiTiles} />
</div>
```

Replace with (right after the `{plan && <div>...secondary bar...</div>}` block):
```tsx
{plan && (
  <PlanKpiBar
    shifts={shifts}
    planFrom={plan.valid_from}
    planTo={plan.valid_to}
    openCount={openCount}
    conflictCount={conflictCount}
  />
)}
```

- [ ] **Step 5: Remove unused imports**

Remove from imports if no longer used elsewhere in the file:
```tsx
import { CommandBar } from '@/components/dp/CommandBar'
import { KpiBar } from '@/components/dp/KpiBar'
```

Also remove `kpiTiles` variable (the array definition around line 412) if only used by KpiBar.

- [ ] **Step 6: TypeScript check**

```
cd frontend && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: Run existing plan tests**

```
cd frontend && npx vitest run src/features/plans
```
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(redesign): wire PlanCommandBar + PlanKpiBar into PlanPage"
```

---

### Task 4: UnifiedPlanGrid header restyling

**Files:**
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

Changes are purely CSS class swaps — no logic changes.

- [ ] **Step 1: Update header corner cell (line 298)**

**Before:**
```tsx
<div className="sticky top-0 left-0 z-20 bg-card border-b border-r border-line px-2 py-1 flex items-end">
  <span className="text-[10px] text-muted-foreground">Bereich / Arzt</span>
</div>
```

**After:**
```tsx
<div className="sticky top-0 left-0 z-20 bg-[#FAF5E9] border-b border-r border-line px-3 py-2.5 flex items-end">
  <span className="text-[11px] text-ink-3 uppercase tracking-[0.06em] font-medium">Arzt</span>
</div>
```

- [ ] **Step 2: Update day-column header className (lines 309–312)**

**Before:**
```tsx
className={cn(
  'sticky top-0 z-10 border-b border-r border-line text-center py-1 px-0.5 transition-colors',
  we ? 'text-muted-foreground' : 'text-ink',
  tod ? 'bg-accent/10 font-bold' : effectiveHoverDay === dk ? 'bg-paper/80' : 'bg-card',
)}
```

**After:**
```tsx
className={cn(
  'sticky top-0 z-10 border-b border-r border-line text-center py-[7px] px-0.5 transition-colors',
  tod ? 'bg-warn-bg' : we ? 'bg-weekend' : effectiveHoverDay === dk ? 'bg-paper/80' : 'bg-[#FAF5E9]',
)}
```

- [ ] **Step 3: Update DOW label + date number (lines 315–316)**

**Before:**
```tsx
<div className="text-[9px] leading-none">{WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
<div className="text-[11px] leading-none mt-0.5">{day.getDate()}</div>
```

**After:**
```tsx
<div className="text-[10px] leading-none text-ink-3">
  {WEEKDAY_ABBR[day.getDay() === 0 ? 6 : day.getDay() - 1]}
</div>
<div className={cn(
  'font-serif text-[16px] leading-[1.1] tabular-nums mt-0.5',
  tod ? 'text-warn-ink' : 'text-ink',
)}>
  {day.getDate()}
</div>
```

- [ ] **Step 4: Run tests**

```
cd frontend && npx vitest run src/features/plans
```
Expected: all green (no logic changed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(redesign): UnifiedPlanGrid header — warm bg + Newsreader date numbers"
```

---

### Task 5: ContextPanel redesign (always-visible + doctor context)

**Files:**
- Modify: `frontend/src/features/plans/components/ContextPanel.tsx`
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: Add selectedDoctorId state in PlanPage**

At the top of `PlanPage()`, after `const [activeCell, setActiveCell] = useState<ActiveCell | null>(null)`, add:
```tsx
const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
```

In `handleCellClick`, in the branch `setActiveCell({ rotationId, doctorId, day, shiftId })`, add:
```tsx
setSelectedDoctorId(doctorId)
```

The final `handleCellClick` non-shiftKey path (starting at `setContextShift(null)`) becomes:
```tsx
setContextShift(null)
setActiveCell({ rotationId, doctorId, day, shiftId })
setSelectedDoctorId(doctorId)
```

- [ ] **Step 2: Extend ContextPanel Props interface**

Replace the existing `interface Props` in `ContextPanel.tsx`:

```tsx
import type { Doctor, ShiftType, Wish } from '@/lib/types'

interface Props {
  // Existing (now optional for always-visible mode):
  shift?: ShiftWithDetails | null
  onClose?: () => void
  tarifWarnings?: TarifWarning[]
  shiftOverrides?: ConstraintOverride[]
  onCreateOverride?: (constraintId: string, reason: string | null) => void
  onDeleteOverride?: (overrideId: number) => void
  // New: doctor context
  selectedDoctorId?: number | null
  doctors?: Doctor[]
  shifts?: ShiftWithDetails[]
  shiftTypes?: ShiftType[]
  wishes?: Wish[]
  planMonth?: string
}
```

- [ ] **Step 3: Rewrite ContextPanel render**

Replace the existing `return (...)` block with:

```tsx
return (
  <div className="w-[290px] shrink-0 flex flex-col bg-paper border-l border-line overflow-hidden">
    {/* ── Sektion 1: Ausgewählt ── */}
    <div className="px-5 pt-4 pb-3 border-b border-line">
      <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
        Ausgewählt
      </p>
      {selectedDoctor ? (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0"
            style={{ background: '#E8DCC4', color: '#26221C' }}
          >
            {selectedDoctor.short_name ?? selectedDoctor.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-serif text-[19px] leading-[1.15] text-ink">
              {selectedDoctor.name}
            </p>
            <p className="text-[12px] text-ink-3 mt-0.5">
              {selectedDoctor.qualification ?? ''}{selectedDoctor.qualification ? ' · ' : ''}{employmentPct != null ? `${employmentPct}%` : ''}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-ink-3">Zelle klicken zum Auswählen</p>
      )}
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* ── Sektion 2: Konflikt-Card ── */}
      {shift && (shift.conflicts.length > 0 || (tarifWarnings && tarifWarnings.length > 0)) && (
        <div>
          {shift.conflicts.length > 0 && (
            <div className="rounded-tile border border-warn-line bg-warn-bg p-[12px_14px] space-y-2">
              <div className="flex items-center gap-2 text-[12px] font-medium text-warn-ink">
                <span className="w-4 h-4 rounded-full bg-warn text-white flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
                {shift.conflicts.length === 1 ? 'Regelkonflikt' : `${shift.conflicts.length} Konflikte`}
                {shift.shift_date ? ` · ${shift.shift_date}` : ''}
              </div>
              {shift.conflicts.map((conflict, i) => (
                <ConflictCard key={i} conflict={conflict} />
              ))}
            </div>
          )}
          {tarifWarnings && tarifWarnings.length > 0 && (
            <div className="space-y-2 mt-2">
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Tarif-Warnungen</p>
              {tarifWarnings.map((w, i) => {
                const override = overrideMap.get(w.rule_id)
                const canOverride = isOverridable(w.rule_id)
                return (
                  <div key={i} className="rounded-lg border border-line bg-paper p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={['rounded-full px-2 py-0.5 text-[10px] font-semibold', SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink'].join(' ')}>
                        {SEVERITY_LABEL[w.severity] ?? w.severity}
                      </span>
                      <span className="text-[11px] text-ink-3">{w.rule_id}</span>
                    </div>
                    <p className="text-[12px] text-ink leading-snug">{w.message}</p>
                    {canOverride && (
                      <div className="pt-1">
                        {override ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] bg-sand border border-warn-line rounded px-2 py-0.5 flex items-center gap-1">
                              <ShieldCheck size={11} /> Override aktiv
                            </span>
                            {override.reason && <span className="text-[11px] text-ink-3 truncate">{override.reason}</span>}
                            <button className="text-[11px] text-ink-3 underline hover:text-ink" onClick={() => onDeleteOverride?.(override.id)}>
                              Widerrufen
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Input
                              className="h-6 text-[11px]"
                              placeholder="Begründung (optional)"
                              value={pendingReason[w.rule_id] ?? ''}
                              onChange={(e) => setPendingReason((r) => ({ ...r, [w.rule_id]: e.target.value }))}
                            />
                            <div className="flex gap-1">
                              <button
                                className="text-[11px] px-2 py-0.5 rounded bg-dp-accent text-white hover:bg-dp-accent-hover"
                                onClick={() => { onCreateOverride?.(w.rule_id, pendingReason[w.rule_id] ?? null); setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n }) }}
                              >
                                Override
                              </button>
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-line text-ink-2 hover:bg-paper"
                                onClick={() => setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n })}
                              >
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Sektion 3: Stunden ── */}
      {selectedDoctor && doctorShiftsInPlan.length > 0 && (
        <div>
          <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1.5">
            Schichten {planMonth ?? ''}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-serif text-[30px] text-ink tabular-nums leading-none">
              {doctorShiftsInPlan.length}
            </span>
            <span className="text-[13px] text-ink-3">Dienste</span>
          </div>
          <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-ok rounded-full" style={{ width: `${Math.min(100, (doctorShiftsInPlan.length / Math.max(1, totalShifts)) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── Sektion 4: Schichten aufgeschlüsselt ── */}
      {selectedDoctor && shiftTypeBreakdown.length > 0 && (
        <div>
          <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Schichttypen</p>
          <div className="space-y-1">
            {shiftTypeBreakdown.map(({ st, count }) => (
              <div key={st.id} className="flex items-center gap-2 text-[12px]">
                <span
                  className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center font-semibold text-[11px] shrink-0"
                  style={{ background: st.color ?? '#E8DCC4', color: '#26221C' }}
                >
                  {st.short_name}
                </span>
                <span className="flex-1 text-ink-2">{st.name}</span>
                <span className="font-serif text-[16px] text-ink tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sektion 5: Wünsche ── */}
      {selectedDoctor && doctorWishes.length > 0 && (
        <div>
          <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Wünsche</p>
          <div className="bg-card border border-line rounded-[10px] p-[10px_12px] text-[12px] text-ink-2 space-y-1">
            {doctorWishes.slice(0, 5).map((w) => (
              <div key={w.id}>
                {w.wish_date ? (
                  <span>{w.wish_date} → <strong>{w.wish_type === 'AVOID_DAY' ? 'frei' : w.wish_type === 'REQUIRE_SHIFT' ? 'Dienst' : 'kein N'}</strong></span>
                ) : (
                  <span className="text-ink-3">{w.wish_type}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leer-Zustand wenn weder Arzt noch Shift */}
      {!selectedDoctor && !shift && (
        <div className="flex flex-col items-center justify-center h-40 text-center text-[12px] text-ink-3 gap-2">
          <span>Zelle im Grid klicken</span>
          <span>um Details anzuzeigen</span>
        </div>
      )}
    </div>

    {/* Header-Schließen-Button wenn Shift selektiert */}
    {shift && onClose && (
      <div className="px-4 py-2 border-t border-line flex items-center justify-between">
        <span className="text-[12px] text-ink-2">
          {shift.shift_type?.short_name} · {shift.shift_date}
        </span>
        <button aria-label="Schließen" onClick={onClose} className="text-ink-3 hover:text-ink transition">
          <X size={16} />
        </button>
      </div>
    )}
  </div>
)
```

Before the `return`, add the derived values (replace the existing `overrideMap` + `isOverridable` with these):
```tsx
const overrideMap = new Map(shiftOverrides.map((o) => [o.constraint_id, o]))
const isOverridable = (ruleId: string) => (REGULATORISCH_HART_IDS as readonly string[]).includes(ruleId)

const selectedDoctor = (doctors ?? []).find((d) => d.id === selectedDoctorId) ?? null
const doctorShiftsInPlan = (shifts ?? []).filter((s) => s.doctor_id === selectedDoctorId)
const totalShifts = (shifts ?? []).length

const employmentPct = selectedDoctor
  ? (selectedDoctor.employment_periods?.find(
      (ep) => ep.valid_to == null || ep.valid_to >= new Date().toISOString().slice(0, 10),
    )?.percentage ?? null)
  : null

const shiftTypeBreakdown = (shiftTypes ?? [])
  .map((st) => ({
    st,
    count: doctorShiftsInPlan.filter((s) => s.shift_type?.id === st.id).length,
  }))
  .filter(({ count }) => count > 0)

const doctorWishes = (wishes ?? []).filter((w) => w.doctor_id === selectedDoctorId)
```

- [ ] **Step 4: Wire always-visible ContextPanel in PlanPage**

In PlanPage.tsx, find:
```tsx
{contextShift && (
  <ContextPanel
    shift={contextShift}
    onClose={() => setContextShift(null)}
    tarifWarnings={tarifWarningsByShift[contextShift.id]}
    shiftOverrides={...}
    onCreateOverride={...}
    onDeleteOverride={handleDeleteOverride}
  />
)}
```

Replace with (inside the `<div className="flex flex-1 overflow-hidden gap-4 px-6 pb-6">` — after the FairnessSidebar conditional):
```tsx
<ContextPanel
  shift={contextShift ?? undefined}
  onClose={contextShift ? () => setContextShift(null) : undefined}
  tarifWarnings={contextShift ? tarifWarningsByShift[contextShift.id] : undefined}
  shiftOverrides={contextShift
    ? constraintOverrides.filter((o) => o.level === 'C' && o.shift_id === contextShift.id)
    : []}
  onCreateOverride={contextShift
    ? (constraintId, reason) => handleCreateCOverride(contextShift.id, constraintId, reason)
    : undefined}
  onDeleteOverride={handleDeleteOverride}
  selectedDoctorId={selectedDoctorId}
  doctors={doctors}
  shifts={shifts}
  shiftTypes={shiftTypes}
  wishes={wishes}
  planMonth={planMonth}
/>
```

Remove the old `{contextShift && <ContextPanel ... />}` block.

- [ ] **Step 5: Add Doctor + ShiftType + Wish imports to ContextPanel.tsx**

Add to top of ContextPanel.tsx imports:
```tsx
import type { Doctor, ShiftType, Wish } from '@/lib/types'
```

- [ ] **Step 6: TypeScript check**

```
cd frontend && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: Run all plan tests**

```
cd frontend && npx vitest run src/features/plans
```
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/plans/components/ContextPanel.tsx frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(redesign): ContextPanel always-visible + doctor context sections"
```

---

## Self-review

**Spec coverage check:**
- ✅ PlanCommandBar: month/italic/year, prev/next, filter chips, conflict chip, search, CTA — Task 1+3
- ✅ PlanKpiBar: coverage%, sparkline, offen, konflikte, heute im Dienst, view tabs — Task 2+3
- ✅ Grid header: `bg-[#FAF5E9]`, DOW 10px, date Newsreader 16px, today/weekend tints — Task 4
- ✅ ContextPanel: always-visible, doctor info, conflict card, schichten, wünsche — Task 5
- ✅ No Tailwind config changes (font-serif already = Newsreader, rounded-cell = 7px) — confirmed

**Placeholder scan:** No TBDs, no "implement later", all steps have complete code.

**Type consistency:**
- `PlanCommandBarProps` defined in Task 1, used in Task 3 — match ✅
- `PlanKpiBarProps` defined in Task 2, used in Task 3 — match ✅
- `ContextPanel Props` extended in Task 5 step 2; `selectedDoctorId` state added in Task 5 step 1 — match ✅
- `selectedDoctor`, `doctorShiftsInPlan`, `shiftTypeBreakdown`, `doctorWishes` computed before return — match ✅
