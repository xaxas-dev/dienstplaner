# PlanPage UI-Verbesserungen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 UI-Verbesserungen an der PlanPage: redundante Buttons entfernen, einklappbare Sidebars, Nachtwoche + Plan-Einstellungen in ModeBar, Plan generieren in beiden Modi, Details-Tab bei Klick, Stations-Details, volle Namen in Fairness, Wunsch-Erfassungs-Button.

**Architecture:** Alle Änderungen Frontend-only. `PlanCommandBar` verliert 3 Props. `PlanModeBar` gewinnt 2 Props (onNachtwocheClick, onSettingsClick) und wird umstrukturiert. `PlanSidebar` gewinnt 5 Props (Dept-Details + onNewWishClick). `BereichHeaderRow` + `UnifiedPlanGrid` bekommen optionalen `onDepartmentClick`-Prop. `PlanPage` koordiniert alles mit neuen States (leftOpen, rightOpen, selectedDepartmentId).

**Tech Stack:** React 18, TypeScript strict, Vitest, @testing-library/react, @dnd-kit/core, shadcn/ui (Popover, Select), lucide-react

---

## Datei-Übersicht

| Datei | Änderung |
|---|---|
| `frontend/src/features/plans/components/PlanCommandBar.tsx` | Entferne Props: `mode`, `onNachtwocheClick`, `onSettingsClick` + jeweilige UI |
| `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx` | Tests für entfernte Features ersetzen |
| `frontend/src/features/plans/components/PlanModeBar.tsx` | CTAs entfernen; Nachtwoche, Settings, Plan generieren (beide Modi) einbauen |
| `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx` | Tests aktualisieren |
| `frontend/src/features/plans/components/PlanSidebar.tsx` | Dept-Details, Fairness-Namen, Wish-Popover, neue Props |
| `frontend/src/features/plans/tests/PlanSidebar.test.tsx` | Tests für neue Features |
| `frontend/src/features/plans/components/BereichHeaderRow.tsx` | `onDepartmentClick?` Prop |
| `frontend/src/features/plans/components/UnifiedPlanGrid.tsx` | `onDepartmentClick?` Prop durchreichen |
| `frontend/src/features/plans/PlanPage.tsx` | States + Handler + Sidebar-Collapse-Layout + Prop-Verdrahtung |

---

## Task 1: PlanCommandBar — Entferne Settings + Nachtwoche + mode

**Files:**
- Modify: `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx`
- Modify: `frontend/src/features/plans/components/PlanCommandBar.tsx`

- [ ] **Step 1: Tests zuerst anpassen (TDD: Tests sollen nach Änderung noch grün sein)**

Ersetze die Datei `frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx` vollständig:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect } from 'vitest'
import { PlanCommandBar } from '../PlanCommandBar'

vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const mockPlan = {
  id: 1,
  name: 'Testplan',
  valid_from: '2026-05-01',
  valid_to: '2026-05-31',
  status: 'DRAFT' as const,
  besetzung_locked: false,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

const base = {
  planMonth: 'Mai',
  planYear: '2026',
  kwRange: '19–20',
  planName: undefined,
  prevPlan: null,
  nextPlan: null,
  plan: mockPlan,
  onNavigatePrev: vi.fn(),
  onNavigateNext: vi.fn(),
  onStatusChange: vi.fn(),
  isUpdatingStatus: false,
  onExport: vi.fn(),
  onOpenCommandPalette: vi.fn(),
}

test('renders month and year', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByText('Mai')).toBeInTheDocument()
  expect(screen.getByText('2026')).toBeInTheDocument()
})

test('renders KW subtitle', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByText(/KW 19–20/)).toBeInTheDocument()
})

test('kein Einstellungen-Button in CommandBar', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.queryByLabelText('Einstellungen')).not.toBeInTheDocument()
})

test('kein Nachtwoche-Button in CommandBar', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.queryByText('Nachtwoche')).not.toBeInTheDocument()
})

test('Such-Pill vorhanden', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByText(/Suchen oder Befehl/)).toBeInTheDocument()
})

test('Export-Button immer sichtbar', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByRole('button', { name: 'Exportieren' })).toBeInTheDocument()
})

test('prev button disabled when prevPlan null', () => {
  render(<PlanCommandBar {...base} prevPlan={null} />)
  expect(screen.getByLabelText('Vorheriger Plan')).toBeDisabled()
})

test('Status-Badge zeigt Entwurf', () => {
  render(<PlanCommandBar {...base} />)
  expect(screen.getByText('Entwurf')).toBeInTheDocument()
})

test('Status-Badge zeigt Freigegeben für RELEASED', () => {
  render(<PlanCommandBar {...base} plan={{ ...mockPlan, status: 'RELEASED' }} />)
  expect(screen.getByText('Freigegeben')).toBeInTheDocument()
})

test('kein Plan → kein Status-Badge', () => {
  render(<PlanCommandBar {...base} plan={undefined} />)
  expect(screen.queryByText('Entwurf')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Tests laufen lassen — erwarte TypeScript-Fehler (Props noch vorhanden)**

```
cd frontend && pnpm test src/features/plans/components/__tests__/PlanCommandBar.test.tsx --run
```

Erwartetes Ergebnis: TypeScript-Compilierungsfehler oder Tests schlagen fehl (fehlende Props im `base`-Objekt).

- [ ] **Step 3: PlanCommandBar.tsx implementieren**

Ersetze `frontend/src/features/plans/components/PlanCommandBar.tsx` vollständig:

```tsx
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface PlanCommandBarProps {
  planMonth: string
  planYear: string
  kwRange: string
  planName?: string
  prevPlan: { id: number; valid_from: string } | null
  nextPlan: { id: number; valid_from: string } | null
  plan: { status: 'DRAFT' | 'RELEASED' | 'ARCHIVED' } | undefined
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onStatusChange: (s: 'DRAFT' | 'RELEASED' | 'ARCHIVED') => void
  isUpdatingStatus: boolean
  onExport: () => void
  onOpenCommandPalette: () => void
}

export function PlanCommandBar({
  planMonth,
  planYear,
  kwRange,
  planName,
  prevPlan,
  nextPlan,
  plan,
  onNavigatePrev,
  onNavigateNext,
  onStatusChange,
  isUpdatingStatus,
  onExport,
  onOpenCommandPalette,
}: PlanCommandBarProps) {
  const statusLabel =
    plan?.status === 'RELEASED' ? 'Freigegeben'
    : plan?.status === 'ARCHIVED' ? 'Archiviert'
    : 'Entwurf'

  const statusDotClass =
    plan?.status === 'RELEASED' ? 'bg-green-500'
    : plan?.status === 'ARCHIVED' ? 'bg-amber-400'
    : 'bg-gray-400'

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-line bg-paper flex-wrap shrink-0">
      {/* Titel */}
      <span className="font-serif text-2xl tracking-tight leading-none">
        <span className="italic text-dp-accent">{planMonth}</span>
        {' '}
        <span className="text-ink">{planYear}</span>
      </span>

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

      {/* Subtitle */}
      <span className="text-[13px] text-ink-3">
        · KW {kwRange}{planName ? ` · ${planName}` : ''}
      </span>

      <div className="flex-1" />

      {/* Status-Badge mit Dropdown */}
      {plan && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isUpdatingStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-line-2 bg-card text-[12.5px] text-ink-2 hover:bg-paper transition-colors disabled:opacity-60"
            >
              <span className={cn('size-1.5 rounded-full', statusDotClass)} />
              {statusLabel}
              <ChevronDown className="size-3 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {plan.status !== 'RELEASED' && (
              <DropdownMenuItem onClick={() => onStatusChange('RELEASED')}>Freigeben</DropdownMenuItem>
            )}
            {plan.status !== 'ARCHIVED' && (
              <DropdownMenuItem onClick={() => onStatusChange('ARCHIVED')}>Archivieren</DropdownMenuItem>
            )}
            {plan.status !== 'DRAFT' && (
              <DropdownMenuItem onClick={() => onStatusChange('DRAFT')}>Zurück zu Entwurf</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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

      {/* Export */}
      <button
        type="button"
        onClick={onExport}
        aria-label="Exportieren"
        className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors"
      >
        Exportieren
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Tests grün verifizieren**

```
cd frontend && pnpm test src/features/plans/components/__tests__/PlanCommandBar.test.tsx --run
```

Erwartetes Ergebnis: Alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanCommandBar.tsx
git add frontend/src/features/plans/components/__tests__/PlanCommandBar.test.tsx
git commit -m "feat(plan): PlanCommandBar — entferne Settings/Nachtwoche/mode Props"
```

---

## Task 2: PlanModeBar — Umstrukturieren

CTAs entfernen (Weiter zu INA / ← Besetzung). Nachtwoche + Settings-Icon + Plan generieren (beide Modi) einbauen.

**Files:**
- Modify: `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx`
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx`

- [ ] **Step 1: Tests aktualisieren**

Ersetze `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx` vollständig:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, describe, beforeEach } from 'vitest'
import { PlanModeBar, makeShiftTypeDragId, parseShiftTypeDragId, makeAbsenceDragId, parseAbsenceDragId } from '../PlanModeBar'

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    useDraggable: () => ({
      attributes: { role: 'button', 'aria-roledescription': 'draggable' },
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: false,
    }),
  }
})

const mockShiftTypes = [
  {
    id: 1, name: 'Vortagsdienst', short_name: 'V', display_order: 0,
    active: true, applies_on_weekdays: true, applies_on_weekend: false,
    is_bereitschaftsdienst: false, filter_group: 'INA',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
  },
  {
    id: 2, name: 'Nachtdienst', short_name: 'N', display_order: 1,
    active: true, applies_on_weekdays: true, applies_on_weekend: true,
    is_bereitschaftsdienst: false, filter_group: 'INA',
    created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
  },
]

const base = {
  mode: 'besetzung' as const,
  onModeChange: vi.fn(),
  shiftTypes: mockShiftTypes,
  activeFilterGroups: new Set<string>(),
  onFilterGroupToggle: vi.fn(),
  onFilterGroupClear: vi.fn(),
  solverEnabled: false,
  isSolving: false,
  onSolve: vi.fn(),
  onNachtwocheClick: vi.fn(),
  onSettingsClick: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('Segmented Switch', () => {
  test('rendert beide Segmente', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByText('Besetzung planen')).toBeInTheDocument()
    expect(screen.getByText('INA planen')).toBeInTheDocument()
  })

  test('Klick auf INA ruft onModeChange("ina") auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} />)
    await user.click(screen.getByText('INA planen'))
    expect(base.onModeChange).toHaveBeenCalledWith('ina')
  })

  test('Klick auf Besetzung ruft onModeChange("besetzung") auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="ina" />)
    await user.click(screen.getByText('Besetzung planen'))
    expect(base.onModeChange).toHaveBeenCalledWith('besetzung')
  })
})

describe('Redundante CTA-Buttons entfernt', () => {
  test('kein "Weiter zu INA planen" Button', () => {
    render(<PlanModeBar {...base} mode="besetzung" />)
    expect(screen.queryByText('Weiter zu INA planen')).not.toBeInTheDocument()
  })

  test('kein "Besetzung" Zurück-Button', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    // Der Text "Besetzung" kommt nur im Segmented Switch vor, nicht als separater Button
    const backBtn = screen.queryByRole('button', { name: /^Besetzung$/ })
    expect(backBtn).not.toBeInTheDocument()
  })
})

describe('Nachtwoche-Button', () => {
  test('sichtbar im Besetzungs-Modus', () => {
    render(<PlanModeBar {...base} mode="besetzung" />)
    expect(screen.getByText('Nachtwoche')).toBeInTheDocument()
  })

  test('nicht sichtbar im INA-Modus', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    expect(screen.queryByText('Nachtwoche')).not.toBeInTheDocument()
  })

  test('Klick ruft onNachtwocheClick auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="besetzung" />)
    await user.click(screen.getByText('Nachtwoche'))
    expect(base.onNachtwocheClick).toHaveBeenCalledOnce()
  })
})

describe('Plan-Einstellungen Button', () => {
  test('Settings-Icon vorhanden', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByLabelText('Plan-Einstellungen')).toBeInTheDocument()
  })

  test('Settings-Icon im INA-Modus vorhanden', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    expect(screen.getByLabelText('Plan-Einstellungen')).toBeInTheDocument()
  })

  test('Klick ruft onSettingsClick auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} />)
    await user.click(screen.getByLabelText('Plan-Einstellungen'))
    expect(base.onSettingsClick).toHaveBeenCalledOnce()
  })
})

describe('Plan generieren — beide Modi', () => {
  test('nicht sichtbar wenn solverEnabled false', () => {
    render(<PlanModeBar {...base} mode="besetzung" solverEnabled={false} />)
    expect(screen.queryByText('Plan generieren')).not.toBeInTheDocument()
  })

  test('sichtbar im Besetzungs-Modus wenn solverEnabled', () => {
    render(<PlanModeBar {...base} mode="besetzung" solverEnabled={true} />)
    expect(screen.getByText('Plan generieren')).toBeInTheDocument()
  })

  test('sichtbar im INA-Modus wenn solverEnabled', () => {
    render(<PlanModeBar {...base} mode="ina" solverEnabled={true} />)
    expect(screen.getByText('Plan generieren')).toBeInTheDocument()
  })

  test('Klick ruft onSolve auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="besetzung" solverEnabled={true} />)
    await user.click(screen.getByText('Plan generieren'))
    expect(base.onSolve).toHaveBeenCalledOnce()
  })

  test('disabled während isSolving', () => {
    render(<PlanModeBar {...base} mode="besetzung" solverEnabled={true} isSolving={true} />)
    expect(screen.getByRole('button', { name: /Berechne/ })).toBeDisabled()
  })
})

describe('Draggable Chips', () => {
  test('ShiftType-Chips werden gerendert (beide Modi)', () => {
    render(<PlanModeBar {...base} mode="besetzung" />)
    expect(screen.getByText('V')).toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  test('ShiftType-Chips auch im INA-Modus sichtbar', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    expect(screen.getByText('V')).toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  test('Abwesenheits-Chips werden gerendert', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByText('U')).toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
    expect(screen.getByText('DIV')).toBeInTheDocument()
  })
})

describe('Fokus-Filter', () => {
  test('"Alle"-Button sichtbar wenn filter_group vorhanden', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByText('Alle')).toBeInTheDocument()
  })

  test('Klick Alle → onFilterGroupClear', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} />)
    await user.click(screen.getByText('Alle'))
    expect(base.onFilterGroupClear).toHaveBeenCalledOnce()
  })

  test('Klick Gruppe → onFilterGroupToggle("INA")', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} />)
    await user.click(screen.getByText('INA'))
    expect(base.onFilterGroupToggle).toHaveBeenCalledWith('INA')
  })
})

describe('Helper-Funktionen', () => {
  test('makeShiftTypeDragId/parseShiftTypeDragId round-trip', () => {
    expect(parseShiftTypeDragId(makeShiftTypeDragId(42))).toBe(42)
  })

  test('parseShiftTypeDragId liefert null für fremde ID', () => {
    expect(parseShiftTypeDragId('absence-URLAUB')).toBeNull()
  })

  test('makeAbsenceDragId/parseAbsenceDragId round-trip', () => {
    expect(parseAbsenceDragId(makeAbsenceDragId('URLAUB'))).toBe('URLAUB')
  })

  test('parseAbsenceDragId liefert null für fremde ID', () => {
    expect(parseAbsenceDragId('shift-1')).toBeNull()
  })
})
```

- [ ] **Step 2: Tests laufen lassen — erwarte Fehler (neue Props noch nicht implementiert)**

```
cd frontend && pnpm test src/features/plans/components/__tests__/PlanModeBar.test.tsx --run
```

Erwartetes Ergebnis: TypeScript-Fehler oder Testfehler (onNachtwocheClick/onSettingsClick fehlen im Interface).

- [ ] **Step 3: PlanModeBar.tsx implementieren**

Ersetze `frontend/src/features/plans/components/PlanModeBar.tsx` vollständig:

```tsx
import React from 'react'
import { ChevronRight, MoonStar, Settings, Zap } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { ShiftType, AbsenceType } from '@/lib/types'

// ─── DnD Helpers ──────────────────────────────────────────────────────────────
export const SHIFT_TYPE_DRAG_ID_PREFIX = 'shift-'

export function makeShiftTypeDragId(shiftTypeId: number): string {
  return `${SHIFT_TYPE_DRAG_ID_PREFIX}${shiftTypeId}`
}

export function parseShiftTypeDragId(id: string): number | null {
  if (!id.startsWith(SHIFT_TYPE_DRAG_ID_PREFIX)) return null
  const n = Number(id.slice(SHIFT_TYPE_DRAG_ID_PREFIX.length))
  return Number.isFinite(n) ? n : null
}

export const ABSENCE_DRAG_ID_PREFIX = 'absence-'

const VALID_ABSENCE_TYPES: AbsenceType[] = [
  'URLAUB', 'KRANKHEIT', 'FORTBILDUNG', 'ELTERNZEIT', 'MUTTERSCHUTZ', 'SONSTIGES',
]

export function makeAbsenceDragId(type: AbsenceType): string {
  return `${ABSENCE_DRAG_ID_PREFIX}${type}`
}

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
  SONSTIGES:    { short: 'DIV',    full: 'Sonstiges' },
}

// ─── Segments ─────────────────────────────────────────────────────────────────
const SEGMENTS = [
  { id: 'besetzung' as const, step: '1', label: 'Besetzung planen', sub: 'Stationen · Urlaub · Nachtwochen' },
  { id: 'ina' as const, step: '2', label: 'INA planen', sub: 'V · T · N-Dienste setzen' },
]

export interface PlanModeBarProps {
  mode: 'besetzung' | 'ina'
  onModeChange: (mode: 'besetzung' | 'ina') => void
  shiftTypes: ShiftType[]
  activeFilterGroups: Set<string>
  onFilterGroupToggle: (group: string) => void
  onFilterGroupClear: () => void
  solverEnabled: boolean
  isSolving: boolean
  onSolve: () => void
  onNachtwocheClick: () => void
  onSettingsClick: () => void
}

export function PlanModeBar({
  mode, onModeChange, shiftTypes,
  activeFilterGroups, onFilterGroupToggle, onFilterGroupClear,
  solverEnabled, isSolving, onSolve,
  onNachtwocheClick, onSettingsClick,
}: PlanModeBarProps) {
  const sortedShiftTypes = [...shiftTypes].sort((a, b) => a.display_order - b.display_order)
  const filterGroups = [
    ...new Set(shiftTypes.map((st) => st.filter_group).filter((g): g is string => g != null)),
  ].sort()

  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-line bg-card flex-wrap shrink-0">
      {/* Segmented Switch */}
      <div className="inline-flex items-center bg-paper border border-line-2 rounded-[14px] p-[3px] gap-[3px] shrink-0">
        {SEGMENTS.map((seg, i) => {
          const active = mode === seg.id
          return (
            <React.Fragment key={seg.id}>
              <button
                type="button"
                onClick={() => onModeChange(seg.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-[11px] border-none transition-colors',
                  active ? 'bg-ink' : 'bg-transparent hover:bg-line/40',
                )}
              >
                <span className={cn(
                  'w-[22px] h-[22px] rounded-full inline-flex items-center justify-center font-serif text-[13px] shrink-0',
                  active ? 'bg-dp-accent text-[#FFF8EF]' : 'bg-line text-ink-3',
                )}>
                  {seg.step}
                </span>
                <span className="text-left">
                  <span className={cn('block text-[12.5px] font-semibold leading-[1.2]', active ? 'text-[#FBF6E8]' : 'text-ink-2')}>
                    {seg.label}
                  </span>
                  <span className={cn('block text-[9.5px] leading-[1.3]', active ? 'text-[rgba(251,246,232,0.52)]' : 'text-ink-3')}>
                    {seg.sub}
                  </span>
                </span>
              </button>
              {i === 0 && <ChevronRight className="size-3 text-ink-3 shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>

      <div className="w-px h-[22px] bg-line mx-1 shrink-0" />

      {/* Chips + Nachtwoche */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sortedShiftTypes.map((st) => (
          <ShiftTypeDraggableChip
            key={st.id}
            shiftType={st}
            dimmed={activeFilterGroups.size > 0 && st.filter_group != null && !activeFilterGroups.has(st.filter_group)}
          />
        ))}

        <span className="text-line-2 mx-0.5">|</span>
        <span className="text-[10px] text-ink-3 uppercase tracking-[0.07em]">Abwesenheiten</span>

        {VALID_ABSENCE_TYPES.map((type) => (
          <AbsenceDraggableChip key={type} absenceType={type} />
        ))}

        {mode === 'besetzung' && (
          <>
            <span className="text-line-2 mx-0.5">|</span>
            <button
              type="button"
              onClick={onNachtwocheClick}
              className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11px] font-medium bg-card border border-line text-ink-2 hover:bg-line/20 transition-colors"
            >
              <MoonStar className="size-3" />
              Nachtwoche
            </button>
          </>
        )}

        {filterGroups.length > 0 && (
          <>
            <span className="text-line-2 mx-0.5">|</span>
            <button
              onClick={onFilterGroupClear}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium border transition',
                activeFilterGroups.size === 0
                  ? 'bg-accent text-white border-accent'
                  : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
              )}
            >
              Alle
            </button>
            {filterGroups.map((group) => (
              <button
                key={group}
                onClick={() => onFilterGroupToggle(group)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium border transition',
                  activeFilterGroups.has(group)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-paper text-ink-3 border-line hover:bg-paper/80',
                )}
              >
                {group}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex-1" />

      {/* Rechts: Settings + Plan generieren */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSettingsClick}
          aria-label="Plan-Einstellungen"
          className="w-[30px] h-[30px] rounded-[8px] border border-line bg-card text-ink-2 flex items-center justify-center hover:bg-paper transition-colors"
        >
          <Settings className="size-3.5" />
        </button>
        {solverEnabled && (
          <button
            type="button"
            onClick={onSolve}
            disabled={isSolving}
            className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-dp-accent text-[#FFF8EF] text-[12.5px] font-semibold hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
          >
            <Zap className="size-3.5" />
            {isSolving ? 'Berechne…' : 'Plan generieren'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────────────────
function ShiftTypeDraggableChip({ shiftType, dimmed }: { shiftType: ShiftType; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeShiftTypeDragId(shiftType.id),
    data: { shiftTypeId: shiftType.id, shortName: shiftType.short_name },
  })
  const pal = colorForShiftType({ id: shiftType.id, code: shiftType.short_name })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={shiftType.name}
      className={cn(
        'inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-bold cursor-grab select-none active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
        dimmed && 'opacity-40',
      )}
      style={{ background: pal.bg, color: pal.fg }}
    >
      {shiftType.short_name}
    </div>
  )
}

function AbsenceDraggableChip({ absenceType }: { absenceType: AbsenceType }) {
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
      title={full}
      className={cn(
        'inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-medium cursor-grab select-none',
        'bg-card border border-line text-ink-2 hover:bg-line/20 active:cursor-grabbing',
        isDragging && 'opacity-40 cursor-grabbing',
      )}
    >
      {short}
    </div>
  )
}
```

- [ ] **Step 4: Tests grün verifizieren**

```
cd frontend && pnpm test src/features/plans/components/__tests__/PlanModeBar.test.tsx --run
```

Erwartetes Ergebnis: Alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx
git add frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx
git commit -m "feat(plan): PlanModeBar — Nachtwoche/Settings eingebaut, CTAs entfernt, Plan generieren beide Modi"
```

---

## Task 3: PlanSidebar — Dept-Details, Fairness-Namen, Wish-Button

**Files:**
- Modify: `frontend/src/features/plans/tests/PlanSidebar.test.tsx`
- Modify: `frontend/src/features/plans/components/PlanSidebar.tsx`

- [ ] **Step 1: Neue Tests ans Ende der Testdatei anfügen**

Öffne `frontend/src/features/plans/tests/PlanSidebar.test.tsx`. Ergänze am Ende (nach den bestehenden Tests) folgende neuen `describe`-Blöcke. Außerdem das `baseProps`-Objekt um die neuen Pflicht-Props erweitern:

**Im `baseProps`-Objekt die neue Pflicht-Prop hinzufügen:**
```tsx
// Im baseProps-Objekt ergänzen:
onNewWishClick: vi.fn(),
```

**Neue describe-Blöcke anhängen:**
```tsx
describe('Fairness-Tab — volle Namen', () => {
  const fairnessProps = {
    ...baseProps,
    mode: 'ina' as const,
    activeTab: 'fairness' as const,
    fairnessStats: [
      { doctorId: 1, doctorName: 'Dr. Anna Müller', shortName: 'AMü', total: 5, byGroup: { INA: 5 } },
    ],
    fairnessGroups: ['INA'],
  }

  it('zeigt vollen Namen statt Abkürzung', () => {
    render(<PlanSidebar {...fairnessProps} />)
    expect(screen.getByText('Dr. Anna Müller')).toBeInTheDocument()
    expect(screen.queryByText('AMü')).not.toBeInTheDocument()
  })
})

describe('Wünsche-Tab — Wunsch erfassen Button', () => {
  const wuenscheProps = {
    ...baseProps,
    mode: 'ina' as const,
    activeTab: 'wuensche' as const,
    doctors: [
      { id: 1, name: 'Dr. Anna Müller', short_name: 'AMü', active: true,
        employment_periods: [], created_at: '', updated_at: '' },
    ],
  }

  it('zeigt "Neu"-Button im Wünsche-Tab', () => {
    render(<PlanSidebar {...wuenscheProps} />)
    expect(screen.getByText('Neu')).toBeInTheDocument()
  })

  it('öffnet Arzt-Picker nach Klick auf "Neu"', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...wuenscheProps} />)
    await user.click(screen.getByText('Neu'))
    expect(screen.getByText('Wunsch für Arzt:')).toBeInTheDocument()
  })
})

describe('Details-Tab — Department-Details', () => {
  const dept = {
    id: 10, name: 'Neurologie', short_name: 'NEU', display_order: 1,
    color: null, max_headcount: null, blocks_ina_weekdays: false, blocks_ina_weekends: false,
    created_at: '', updated_at: '',
  }
  const rotation = {
    id: 100, plan_id: 1, doctor_id: 1, department_id: 10,
    valid_from: '2026-05-01', valid_to: '2026-05-31', is_einarbeitung: false,
    doctor: null, department: dept, created_at: '', updated_at: '',
  }
  const doctor = {
    id: 1, name: 'Dr. Anna Müller', short_name: 'AMü', active: true,
    employment_periods: [{ id: 1, doctor_id: 1, employment_percentage: 75, valid_from: '2026-01-01', valid_to: null, created_at: '', updated_at: '' }],
    created_at: '', updated_at: '',
  }

  const deptProps = {
    ...baseProps,
    selectedDepartmentId: 10,
    departments: [dept],
    rotations: [rotation],
    doctors: [doctor],
    onDepartmentDeselect: vi.fn(),
  }

  it('zeigt Stationsnamen', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText('Neurologie')).toBeInTheDocument()
  })

  it('zeigt zugewiesenen Arzt', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText('Dr. Anna Müller')).toBeInTheDocument()
  })

  it('zeigt FTE des Arztes', () => {
    render(<PlanSidebar {...deptProps} />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Tests laufen lassen — erwarte Fehler**

```
cd frontend && pnpm test src/features/plans/tests/PlanSidebar.test.tsx --run
```

Erwartetes Ergebnis: TypeScript-Fehler oder Testfehler (neue Props/Features fehlen).

- [ ] **Step 3: PlanSidebar.tsx implementieren**

**3a — Imports ergänzen:**

Ändere die Import-Zeilen am Anfang von `frontend/src/features/plans/components/PlanSidebar.tsx`:

Bisherige Zeile 1-3:
```tsx
import { useMemo, useState } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { Star, ShieldCheck, ShieldOff } from 'lucide-react'
```

Ersetzen durch:
```tsx
import { useMemo, useState } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { Star, ShieldCheck, ShieldOff, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getDepartmentColor } from '@/lib/bereichColors'
```

Bisherige Zeile 10:
```tsx
import type { TarifWarning, ConstraintOverride, Doctor, ShiftType, Wish } from '@/lib/types'
```

Ersetzen durch:
```tsx
import type { TarifWarning, ConstraintOverride, Doctor, ShiftType, Wish, Department, RotationAssignmentWithDetails } from '@/lib/types'
```

**3b — Interface erweitern:**

Nach Zeile 69 (`onScrollToShift: (shiftId: number) => void`) folgende Props ergänzen:

```tsx
  // Department-Details
  selectedDepartmentId?: number | null
  departments?: Department[]
  rotations?: RotationAssignmentWithDetails[]
  onDepartmentDeselect?: () => void
  // Wunsch erstellen
  onNewWishClick: (doctorId: number) => void
```

**3c — Neue States in der Komponente:**

Nach Zeile 81 (`const [pendingReason, setState] ...`):

```tsx
  const [wishPickerOpen, setWishPickerOpen] = useState(false)
  const [wishPickerDoctorId, setWishPickerDoctorId] = useState<string>('')
```

**3d — Neue Berechnungen:**

Nach `const doctorWishes = wishes.filter(...)` (ca. Zeile 120):

```tsx
  const selectedDepartment = (departments ?? []).find(d => d.id === selectedDepartmentId) ?? null
  const deptRotations = useMemo(
    () => (rotations ?? []).filter(r => r.department_id === selectedDepartmentId),
    [rotations, selectedDepartmentId],
  )
  const deptDoctors = useMemo(
    () => deptRotations
      .map(r => doctors.find(d => d.id === r.doctor_id))
      .filter((d): d is Doctor => d != null),
    [deptRotations, doctors],
  )
```

**3e — Details-Tab: Department-Block einfügen:**

Im Details-Tab (nach dem "Ausgewählt"-Abschnitt mit `selectedDoctor`, ca. nach Zeile 212), einen neuen Block einfügen — **aber nur wenn kein shift aktiv ist**:

Suche den Beginn des Details-Tabs `{activeTab === 'details' && (` und ersetze den `<div className="p-4 space-y-4">` Abschnitt so, dass **vor** dem `selectedDoctor`-Block folgendes steht:

```tsx
{/* Station ausgewählt */}
{selectedDepartment && !shift && (
  <div>
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium">Station</p>
      {onDepartmentDeselect && (
        <button
          type="button"
          onClick={onDepartmentDeselect}
          className="text-[11px] text-ink-3 hover:text-ink transition"
        >
          ✕
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      <div
        className="w-3 h-10 rounded-sm shrink-0"
        style={{ background: getDepartmentColor(selectedDepartment) }}
      />
      <div>
        <p className="font-serif text-[19px] leading-[1.15] text-ink">{selectedDepartment.name}</p>
        <p className="text-[12px] text-ink-3">{deptDoctors.length} {deptDoctors.length === 1 ? 'Arzt' : 'Ärzte'}</p>
      </div>
    </div>
    {deptDoctors.length > 0 ? (
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1">Besetzung</p>
        {deptDoctors.map((doc) => {
          const ep = doc.employment_periods?.find(
            (ep) => ep.valid_to == null || ep.valid_to >= today,
          )
          const fte = ep?.employment_percentage ?? null
          const shiftCount = shifts.filter((s) => s.doctor_id === doc.id).length
          return (
            <div key={doc.id} className="flex items-center gap-2 text-[12px]">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                style={{ background: '#E8DCC4', color: '#26221C' }}
              >
                {doc.short_name ?? doc.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 text-ink truncate">{doc.name}</span>
              <span className="text-ink-3 tabular-nums text-[11px] shrink-0">
                {fte != null ? `${fte}%` : ''}{fte != null && shiftCount > 0 ? ' · ' : ''}{shiftCount > 0 ? `${shiftCount} D` : ''}
              </span>
            </div>
          )
        })}
      </div>
    ) : (
      <p className="text-[12px] text-ink-3 mt-2">Keine Ärzte zugewiesen</p>
    )}
  </div>
)}
```

**3f — Fairness-Tab: `shortName` durch `doctorName` ersetzen:**

Suche Zeile ~550:
```tsx
{stat.shortName ?? stat.doctorName}
```
Ersetzen durch:
```tsx
{stat.doctorName}
```

**3g — Wünsche-Tab: Neu-Button + Popover einbauen:**

Im Wünsche-Tab, direkt nach `{activeTab === 'wuensche' && (` und vor dem `<button ... onToggleWishes>`:

```tsx
<div className="flex items-center justify-between mb-1">
  <span className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium">Wünsche im Plan</span>
  <Popover
    open={wishPickerOpen}
    onOpenChange={(open) => {
      setWishPickerOpen(open)
      if (!open) setWishPickerDoctorId('')
    }}
  >
    <PopoverTrigger asChild>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-ink-2 border border-line rounded-lg px-2 py-1 hover:bg-line/30 transition-colors"
      >
        <Plus className="size-3" /> Neu
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-[220px] p-3 space-y-2" align="end">
      <p className="text-[11px] font-medium text-ink-3">Wunsch für Arzt:</p>
      <Select value={wishPickerDoctorId} onValueChange={setWishPickerDoctorId}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Arzt auswählen…" />
        </SelectTrigger>
        <SelectContent>
          {doctors.map((d) => (
            <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        disabled={!wishPickerDoctorId}
        onClick={() => {
          if (wishPickerDoctorId) {
            onNewWishClick(Number(wishPickerDoctorId))
            setWishPickerOpen(false)
            setWishPickerDoctorId('')
          }
        }}
        className="w-full px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 transition-opacity"
      >
        Weiter
      </button>
    </PopoverContent>
  </Popover>
</div>
```

- [ ] **Step 4: Tests grün verifizieren**

```
cd frontend && pnpm test src/features/plans/tests/PlanSidebar.test.tsx --run
```

Erwartetes Ergebnis: Alle Tests PASS inkl. der neuen.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanSidebar.tsx
git add frontend/src/features/plans/tests/PlanSidebar.test.tsx
git commit -m "feat(plan): PlanSidebar — Dept-Details, Fairness-Namen, Wunsch-Popover"
```

---

## Task 4: BereichHeaderRow + UnifiedPlanGrid — Department-Klick

**Files:**
- Modify: `frontend/src/features/plans/components/BereichHeaderRow.tsx`
- Modify: `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`

- [ ] **Step 1: BereichHeaderRow erweitern**

Öffne `frontend/src/features/plans/components/BereichHeaderRow.tsx`.

Ändere das Interface (ca. Zeile 32–35):
```tsx
interface BereichHeaderRowProps {
  department: Department
  rotationCount?: number
  onDepartmentClick?: (departmentId: number) => void
}
```

Ändere die Funktionssignatur (ca. Zeile 37):
```tsx
export function BereichHeaderRow({ department, rotationCount, onDepartmentClick }: BereichHeaderRowProps) {
```

Ergänze im Label-Div (ca. Zeile 49–56) `onClick` und `cursor-pointer`:
```tsx
<div
  ref={setNodeRef}
  onClick={() => onDepartmentClick?.(department.id)}
  className="sticky left-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-line"
  style={{
    borderLeft: `4px solid ${color}`,
    backgroundColor: bg,
    cursor: onDepartmentClick ? 'pointer' : undefined,
  }}
>
```

- [ ] **Step 2: UnifiedPlanGrid erweitern**

Öffne `frontend/src/features/plans/components/UnifiedPlanGrid.tsx`.

Im `UnifiedPlanGridProps`-Interface (ca. Zeile 18–44) ergänzen:
```tsx
  onDepartmentClick?: (departmentId: number) => void
```

In der Funktionssignatur destructuren:
```tsx
function UnifiedPlanGrid({
  ...,
  onDepartmentClick,
}: UnifiedPlanGridProps) {
```

Den `<BereichHeaderRow>`-Aufruf (suche nach `<BereichHeaderRow department=`) erweitern:
```tsx
<BereichHeaderRow
  department={dept}
  rotationCount={deptRotations.length}
  onDepartmentClick={onDepartmentClick}
/>
```

- [ ] **Step 3: Tests prüfen (keine neuen Tests nötig — optionaler Prop, bestehendes Verhalten unverändert)**

```
cd frontend && pnpm test --run 2>&1 | tail -20
```

Erwartetes Ergebnis: Alle bestehenden Tests PASS, keine neuen Fehler.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/plans/components/BereichHeaderRow.tsx
git add frontend/src/features/plans/components/UnifiedPlanGrid.tsx
git commit -m "feat(plan): BereichHeaderRow/UnifiedPlanGrid — onDepartmentClick Prop"
```

---

## Task 5: PlanPage — Alles verdrahten + einklappbare Sidebars

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: Imports ergänzen**

Ganz oben in `frontend/src/features/plans/PlanPage.tsx`, in den bestehenden Importen:

Nach Zeile 1 (`import { useCallback, useEffect, useMemo, useRef, useState } from 'react'`) keine Änderung.

Füge diesen Import hinzu (nach den Lucide-/Icon-Imports, die aus anderen Komponenten kommen — PlanPage hat aktuell keine direkten Lucide-Imports):
```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
```

- [ ] **Step 2: Neue States hinzufügen**

Im State-Block (nach Zeile 158 `const [mode, setMode] = useState...`):
```tsx
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null)
```

- [ ] **Step 3: handleCellClick aktualisieren**

Suche `function handleCellClick(` (ca. Zeile 426). Im Body, beim `setActiveCell`-Aufruf (nach `setContextShift(null)`) ergänzen:

```tsx
    setContextShift(null)
    setSelectedDepartmentId(null)          // NEU
    setActiveCell({ rotationId, doctorId, day, shiftId })
    setSelectedDoctorId(doctorId)
    setSidebarTab('details')               // NEU
```

- [ ] **Step 4: handleDepartmentClick hinzufügen**

Nach `handleCellClick` (ca. Zeile 452) einfügen:
```tsx
  function handleDepartmentClick(departmentId: number) {
    setSelectedDepartmentId(departmentId)
    setSelectedDoctorId(null)
    setContextShift(null)
    setSidebarTab('details')
  }
```

- [ ] **Step 5: PlanCommandBar-Aufruf bereinigen**

Suche den `<PlanCommandBar`-Aufruf (ca. Zeile 753). Entferne die drei Props:
- `mode={mode}`
- `onNachtwocheClick={() => setLockedWeekDialogOpen(true)}`
- `onSettingsClick={() => setSettingsOpen(true)}`

Ergebnis:
```tsx
<PlanCommandBar
  planMonth={planMonth}
  planYear={planYearLabel}
  kwRange={kwRange}
  planName={undefined}
  prevPlan={prevPlan}
  nextPlan={nextPlan}
  plan={plan}
  onNavigatePrev={() => prevPlan && navigate(`/plans/${planToSlug(prevPlan)}`)}
  onNavigateNext={() => nextPlan && navigate(`/plans/${planToSlug(nextPlan)}`)}
  onStatusChange={handleStatusChange}
  isUpdatingStatus={updatePlan.isPending}
  onExport={() => !isNaN(id) && window.location.assign(`/api/plans/${id}/export`)}
  onOpenCommandPalette={openCommandPalette}
/>
```

- [ ] **Step 6: PlanModeBar-Aufruf erweitern**

Suche den `<PlanModeBar`-Aufruf (ca. Zeile 771). Zwei neue Props ergänzen:

```tsx
<PlanModeBar
  mode={mode}
  onModeChange={setMode}
  shiftTypes={shiftTypes}
  activeFilterGroups={activeFilterGroups}
  onFilterGroupToggle={toggleFilterGroup}
  onFilterGroupClear={clearFilterGroups}
  solverEnabled={solverEnabled}
  isSolving={solvePlan.isPending}
  onSolve={handleSolve}
  onNachtwocheClick={() => setLockedWeekDialogOpen(true)}
  onSettingsClick={() => setSettingsOpen(true)}
/>
```

- [ ] **Step 7: UnifiedPlanGrid — onDepartmentClick verdrahten**

Im `<UnifiedPlanGrid>`-Aufruf (ca. Zeile 817) nach `onWishCreate`:
```tsx
  onDepartmentClick={handleDepartmentClick}
```

- [ ] **Step 8: Linke Sidebar — einklappbar machen**

Suche den Block (ca. Zeile 806):
```tsx
{mode === 'besetzung' && (
  <DoctorDragSource
    ...
  />
)}
```

Ersetzen durch:
```tsx
{mode === 'besetzung' && (
  <div className="flex shrink-0">
    {leftOpen && (
      <DoctorDragSource
        doctors={doctors}
        rotationDoctorIds={assignedDoctorIds}
        highlightedDoctorId={highlightedDoctorId}
        onHighlightDoctor={setHighlightedDoctorId}
        locked={plan?.besetzung_locked ?? false}
      />
    )}
    <button
      type="button"
      onClick={() => setLeftOpen((v) => !v)}
      className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-r border-line shrink-0"
      aria-label={leftOpen ? 'Arzt-Sidebar einklappen' : 'Arzt-Sidebar ausklappen'}
    >
      {leftOpen
        ? <ChevronLeft className="size-3 text-ink-3" />
        : <ChevronRight className="size-3 text-ink-3" />
      }
    </button>
  </div>
)}
```

- [ ] **Step 9: Rechte Sidebar — einklappbar machen (enthält alle neuen PlanSidebar-Props)**

Suche den Block (ca. Zeile 867):
```tsx
{plan && (
  <PlanSidebar
    ...
  />
)}
```

Ersetzen durch:
```tsx
{plan && (
  <div className="flex shrink-0">
    <button
      type="button"
      onClick={() => setRightOpen((v) => !v)}
      className="w-5 flex items-center justify-center self-stretch hover:bg-line/30 transition-colors border-l border-line shrink-0"
      aria-label={rightOpen ? 'Detail-Sidebar einklappen' : 'Detail-Sidebar ausklappen'}
    >
      {rightOpen
        ? <ChevronRight className="size-3 text-ink-3" />
        : <ChevronLeft className="size-3 text-ink-3" />
      }
    </button>
    {rightOpen && (
      <PlanSidebar
        shifts={shifts}
        planFrom={plan.valid_from}
        planTo={plan.valid_to}
        openCount={openCount}
        conflictCount={conflictCount}
        onConflictBadgeClick={() => setSidebarTab('konflikte')}
        mode={mode}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        shift={contextShift ?? undefined}
        onCloseShift={contextShift ? () => setContextShift(null) : undefined}
        tarifWarnings={contextShift ? tarifWarningsByShift[contextShift.id] : undefined}
        shiftOverrides={
          contextShift
            ? constraintOverrides.filter((o) => o.level === 'C' && o.shift_id === contextShift.id)
            : []
        }
        onCreateOverride={
          contextShift
            ? (constraintId, reason) => handleCreateCOverride(contextShift.id, constraintId, reason)
            : undefined
        }
        onDeleteOverride={handleDeleteOverride}
        selectedDoctorId={selectedDoctorId}
        doctors={doctors}
        shiftTypes={shiftTypes}
        wishes={wishes}
        planMonth={planMonth}
        showWishes={showWishes}
        onToggleWishes={() => setShowWishes((v) => !v)}
        fairnessStats={fairnessStats}
        fairnessGroups={fairnessGroups}
        conflicts={conflicts ?? null}
        onScrollToShift={scrollToShift}
        selectedDepartmentId={selectedDepartmentId}
        departments={departments}
        rotations={rotations}
        onDepartmentDeselect={() => setSelectedDepartmentId(null)}
        onNewWishClick={(doctorId) => setWishCreateTarget({ doctorId, date: format(new Date(), 'yyyy-MM-dd') })}
      />
    )}
  </div>
)}
```

- [ ] **Step 10: Gesamte Test-Suite laufen lassen**

```
cd frontend && pnpm test --run 2>&1 | tail -30
```

Erwartetes Ergebnis: Alle Tests PASS, 0 Fehler.

- [ ] **Step 11: TypeScript-Check**

```
cd frontend && pnpm tsc --noEmit 2>&1 | head -40
```

Erwartetes Ergebnis: keine Fehler.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plan): PlanPage — Sidebar-Collapse, Dept-Klick, Tab-Autoswitch, Props verdrahtet"
```

---

## Spec-Abdeckungs-Checkliste

| Anforderung | Task |
|---|---|
| ✅ Entferne "Weiter zu INA planen" | Task 2 |
| ✅ Entferne "< Besetzung" | Task 2 |
| ✅ Linke Sidebar einklappbar | Task 5 (Step 9) |
| ✅ Rechte Sidebar einklappbar | Task 5 (Step 10) |
| ✅ Nachtwoche in ModeBar | Task 2 |
| ✅ Settings-Icon aus CommandBar entfernt | Task 1 |
| ✅ Settings-Icon in ModeBar neben Plan generieren | Task 2 |
| ✅ Plan generieren in beiden Modi | Task 2 |
| ✅ Details-Tab bei Arzt-Klick | Task 5 (Step 3) |
| ✅ Stationsklick → Dept-Details in Sidebar | Task 4 + Task 3 + Task 5 (Steps 4, 7) |
| ✅ Volle Namen in Fairness | Task 3 (Step 3f) |
| ✅ Wunsch-Erfassungs-Button mit Popover | Task 3 (Step 3g) |
