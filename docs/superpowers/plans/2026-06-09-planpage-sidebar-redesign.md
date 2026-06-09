# PlanPage Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konsolidiere PlanPage: DnD-Chips direkt in ModeBar, KpiBar + Wünsche/Fairness/Konflikte in eine Tab-Sidebar, Arzt-Panel nur im Besetzungs-Modus.

**Architecture:** PlanModeBar bekommt useDraggable auf allen Chips (ShiftType + Abwesenheit) + Fokus-Filter-Buttons. Neue `PlanSidebar`-Komponente ersetzt `ContextPanel` + `FairnessSidebar` mit Tabs (Details/Konflikte/Wünsche/Fairness), modusspezifisch. KPI-Daten (Abdeckung, Sparkline, offen, Konflikte) als fester Streifen über den Tabs. `DoctorDragSource` nur im Besetzungs-Modus.

**Tech Stack:** React 18, TypeScript strict, @dnd-kit/core, Tailwind, vitest + @testing-library/react

---

## Dateiübersicht

| Datei | Aktion |
|-------|--------|
| `frontend/src/features/plans/components/PlanModeBar.tsx` | Refactor: DnD-Helpers exportieren, Chips draggable, Fokus-Filter einziehen, Props bereinigen |
| `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx` | Aktualisieren: alte Props entfernen, neue Chip-/Filter-Tests |
| `frontend/src/features/plans/components/PlanSidebar.tsx` | NEU: KPI-Strip + Tab-Navigation + alle Tab-Inhalte |
| `frontend/src/features/plans/tests/PlanSidebar.test.tsx` | NEU: Tests für KPI, Tabs, Modus-Abhängigkeit, Tab-Inhalte |
| `frontend/src/features/plans/PlanPage.tsx` | Integrieren: sidebarTab-State, scrollToShift, DoctorDragSource konditional, alte Blöcke entfernen |
| `frontend/src/features/plans/components/ShiftTypeDragBar.tsx` | LÖSCHEN (Helpers nach PlanModeBar migriert) |
| `frontend/src/features/plans/components/AbsenceTypeDragBar.tsx` | LÖSCHEN (Helpers nach PlanModeBar migriert) |
| `frontend/src/features/plans/components/PlanKpiBar.tsx` | LÖSCHEN (KPI in PlanSidebar) |
| `frontend/src/features/plans/components/ContextPanel.tsx` | LÖSCHEN (Inhalt in PlanSidebar Details-Tab) |
| `frontend/src/features/plans/components/FairnessSidebar.tsx` | LÖSCHEN (Inhalt in PlanSidebar Fairness-Tab) |
| `frontend/src/features/plans/tests/ContextPanel.test.tsx` | LÖSCHEN (durch PlanSidebar.test.tsx abgedeckt) |
| `frontend/src/features/plans/tests/FairnessSidebar.test.tsx` | LÖSCHEN (durch PlanSidebar.test.tsx abgedeckt) |
| `frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx` | LÖSCHEN |

---

## Task 1: PlanModeBar — Refactor

**Files:**
- Modify: `frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx`
- Modify: `frontend/src/features/plans/components/PlanModeBar.tsx`

- [ ] **Step 1: Test-Datei aktualisieren (failing)**

Ersetze `__tests__/PlanModeBar.test.tsx` vollständig:

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

describe('CTA Besetzungs-Modus', () => {
  test('zeigt "Weiter zu INA planen"', () => {
    render(<PlanModeBar {...base} mode="besetzung" />)
    expect(screen.getByText('Weiter zu INA planen')).toBeInTheDocument()
  })

  test('Klick auf CTA ruft onModeChange("ina") auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="besetzung" />)
    await user.click(screen.getByText('Weiter zu INA planen'))
    expect(base.onModeChange).toHaveBeenCalledWith('ina')
  })
})

describe('CTA INA-Modus', () => {
  test('zeigt Zurück-Button', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    expect(screen.getByText('Besetzung')).toBeInTheDocument()
  })

  test('zeigt keinen Solver-CTA wenn solverEnabled false', () => {
    render(<PlanModeBar {...base} mode="ina" solverEnabled={false} />)
    expect(screen.queryByText('Plan generieren')).not.toBeInTheDocument()
  })

  test('zeigt Solver-CTA wenn solverEnabled true', () => {
    render(<PlanModeBar {...base} mode="ina" solverEnabled={true} />)
    expect(screen.getByText('Plan generieren')).toBeInTheDocument()
  })

  test('Solver-CTA ruft onSolve auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="ina" solverEnabled={true} />)
    await user.click(screen.getByText('Plan generieren'))
    expect(base.onSolve).toHaveBeenCalledOnce()
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

  test('keine Wünsche/Fairness-Buttons in PlanModeBar', () => {
    render(<PlanModeBar {...base} mode="ina" />)
    expect(screen.queryByText('Wünsche')).not.toBeInTheDocument()
    expect(screen.queryByText('Fairness')).not.toBeInTheDocument()
  })

  test('kein Konflikte-Badge in PlanModeBar', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.queryByText(/Konflikte/)).not.toBeInTheDocument()
  })
})

describe('Fokus-Filter', () => {
  test('"Alle"-Button sichtbar wenn filter_group vorhanden', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByText('Alle')).toBeInTheDocument()
  })

  test('Gruppen-Buttons aus ShiftType.filter_group', () => {
    render(<PlanModeBar {...base} />)
    expect(screen.getByText('INA')).toBeInTheDocument()
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

- [ ] **Step 2: Test laufen lassen — erwartet FAIL**

```bash
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanModeBar.test.tsx
```

Erwartet: Fehler wegen fehlender Exports `makeShiftTypeDragId`, `parseShiftTypeDragId`, `makeAbsenceDragId`, `parseAbsenceDragId` + TypeScript-Fehler Props.

- [ ] **Step 3: PlanModeBar.tsx ersetzen**

Ersetze `frontend/src/features/plans/components/PlanModeBar.tsx` vollständig:

```tsx
import React from 'react'
import { ChevronRight, ChevronLeft, Zap } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { colorForShiftType } from '@/lib/design/shift-palette'
import type { ShiftType, AbsenceType } from '@/lib/types'

// ─── DnD Helpers (migriert von ShiftTypeDragBar + AbsenceTypeDragBar) ─────────
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

// ─── Komponente ───────────────────────────────────────────────────────────────
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
}

export function PlanModeBar({
  mode, onModeChange, shiftTypes,
  activeFilterGroups, onFilterGroupToggle, onFilterGroupClear,
  solverEnabled, isSolving, onSolve,
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

      {/* Draggable Chips — beide Modi identisch */}
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

      {/* CTA */}
      {mode === 'besetzung' ? (
        <button
          type="button"
          onClick={() => onModeChange('ina')}
          className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-ink text-[#FBF6E8] text-[12.5px] font-semibold hover:opacity-90 transition-opacity"
        >
          Weiter zu INA planen
          <ChevronRight className="size-3.5" />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onModeChange('besetzung')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-line-2 bg-paper text-ink-2 text-[12px] hover:bg-line/30 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
            Besetzung
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
      )}
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

- [ ] **Step 4: Tests laufen lassen — erwartet PASS**

```bash
cd frontend && npx vitest run src/features/plans/components/__tests__/PlanModeBar.test.tsx
```

Erwartet: alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanModeBar.tsx \
        frontend/src/features/plans/components/__tests__/PlanModeBar.test.tsx
git commit -m "feat(plan): PlanModeBar — draggable chips, DnD helpers, Fokus-Filter; Props bereinigt"
```

---

## Task 2: PlanSidebar erstellen

**Files:**
- Create: `frontend/src/features/plans/components/PlanSidebar.tsx`
- Create: `frontend/src/features/plans/tests/PlanSidebar.test.tsx`

- [ ] **Step 1: Test-Datei schreiben (failing)**

Erstelle `frontend/src/features/plans/tests/PlanSidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanSidebar } from '../components/PlanSidebar'
import type { components } from '@/lib/api-types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

function makeShift(overrides: Partial<ShiftWithDetails> = {}): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-15', shift_type_id: 1,
    doctor_id: 1, is_pinned: false, is_locked: false, notes: null,
    created_at: '', updated_at: '',
    shift_type: { id: 1, name: 'Nachtdienst', short_name: 'N', applies_on_weekdays: true,
      applies_on_weekend: true, start_time: null, end_time: null,
      display_order: 0, active: true, notes: null, is_bereitschaftsdienst: false,
      created_at: '', updated_at: '' },
    doctor: null,
    conflicts: [],
    ...overrides,
  }
}

const baseProps = {
  shifts: [makeShift(), makeShift({ id: 2, shift_date: '2026-05-16', doctor_id: null })],
  planFrom: '2026-05-01',
  planTo: '2026-05-31',
  openCount: 1,
  conflictCount: 0,
  onConflictBadgeClick: vi.fn(),
  mode: 'besetzung' as const,
  activeTab: 'details' as const,
  onTabChange: vi.fn(),
  shift: null,
  onCloseShift: vi.fn(),
  tarifWarnings: [],
  shiftOverrides: [],
  onCreateOverride: vi.fn(),
  onDeleteOverride: vi.fn(),
  selectedDoctorId: null,
  doctors: [],
  shiftTypes: [],
  wishes: [],
  planMonth: 'Mai',
  showWishes: false,
  onToggleWishes: vi.fn(),
  fairnessStats: [],
  fairnessGroups: [],
  conflicts: null,
  onScrollToShift: vi.fn(),
}

describe('KPI-Strip', () => {
  it('zeigt Abdeckungs-Prozent', () => {
    render(<PlanSidebar {...baseProps} />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('zeigt openCount', () => {
    render(<PlanSidebar {...baseProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('Klick auf Konflikte-Badge ruft onConflictBadgeClick auf', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} conflictCount={3} />)
    await user.click(screen.getByText('3'))
    expect(baseProps.onConflictBadgeClick).toHaveBeenCalledOnce()
  })
})

describe('Tab-Navigation — Besetzungs-Modus', () => {
  it('zeigt Details und Konflikte Tabs', () => {
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Konflikte' })).toBeInTheDocument()
  })

  it('zeigt KEINE Wünsche/Fairness Tabs im Besetzungs-Modus', () => {
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    expect(screen.queryByRole('tab', { name: 'Wünsche' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Fairness' })).not.toBeInTheDocument()
  })

  it('Klick auf Konflikte-Tab → onTabChange("konflikte")', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} mode="besetzung" />)
    await user.click(screen.getByRole('tab', { name: 'Konflikte' }))
    expect(baseProps.onTabChange).toHaveBeenCalledWith('konflikte')
  })
})

describe('Tab-Navigation — INA-Modus', () => {
  it('zeigt alle vier Tabs', () => {
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="details" />)
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Wünsche' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Fairness' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Konflikte' })).toBeInTheDocument()
  })
})

describe('Details Tab', () => {
  it('zeigt Leer-Zustand wenn kein Arzt ausgewählt', () => {
    render(<PlanSidebar {...baseProps} activeTab="details" />)
    expect(screen.getByText(/Zelle klicken/i)).toBeInTheDocument()
  })

  it('zeigt Konflikt-Nachricht wenn Shift mit Konflikten übergeben', () => {
    const shift = makeShift({
      conflicts: [{ shift_id: 1, conflict_type: 'not_available', message: 'Test-Konflikt',
        doctor_id: 1, doctor_name: 'Dr. Test', shift_date: '2026-05-15', shift_type_short_name: 'N' }],
    })
    render(<PlanSidebar {...baseProps} activeTab="details" shift={shift} />)
    expect(screen.getByText('Test-Konflikt')).toBeInTheDocument()
  })
})

describe('Konflikte Tab', () => {
  it('zeigt "Keine Konflikte" wenn leer', () => {
    render(<PlanSidebar {...baseProps} activeTab="konflikte" conflicts={null} />)
    expect(screen.getByText(/Keine Konflikte/i)).toBeInTheDocument()
  })

  it('zeigt Konflikt-Einträge und löst Scroll bei Klick aus', async () => {
    const user = userEvent.setup()
    const conflicts = { conflicts: [{ shift_id: 1 }], open_shifts: [] }
    render(<PlanSidebar {...baseProps} activeTab="konflikte" conflicts={conflicts} />)
    const btn = screen.getByRole('button', { name: /2026-05-15/i })
    await user.click(btn)
    expect(baseProps.onScrollToShift).toHaveBeenCalledWith(1)
  })
})

describe('Wünsche Tab (INA)', () => {
  it('zeigt Toggle-Button', () => {
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="wuensche" />)
    expect(screen.getByText(/Wunsch-Hinweise/i)).toBeInTheDocument()
  })

  it('Toggle-Button ruft onToggleWishes auf', async () => {
    const user = userEvent.setup()
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="wuensche" />)
    await user.click(screen.getByText(/Wunsch-Hinweise/i))
    expect(baseProps.onToggleWishes).toHaveBeenCalledOnce()
  })
})

describe('Fairness Tab (INA)', () => {
  it('zeigt Arzt-Tabelle', () => {
    const stats = [{ doctorId: 1, doctorName: 'Müller, Anna', shortName: 'AM', total: 5, byGroup: { INA: 3 } }]
    render(<PlanSidebar {...baseProps} mode="ina" activeTab="fairness"
      fairnessStats={stats} fairnessGroups={['INA']} />)
    expect(screen.getByText('AM')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Test laufen — erwartet FAIL (Datei existiert nicht)**

```bash
cd frontend && npx vitest run src/features/plans/tests/PlanSidebar.test.tsx
```

Erwartet: Fehler "Cannot find module".

- [ ] **Step 3: PlanSidebar.tsx erstellen**

Erstelle `frontend/src/features/plans/components/PlanSidebar.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { Star, ShieldCheck, ShieldOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConflictCard } from './ConflictCard'
import { REGULATORISCH_HART_IDS } from '@/lib/types'
import type { components } from '@/lib/api-types'
import type { TarifWarning, ConstraintOverride, Doctor, ShiftType, Wish } from '@/lib/types'
import type { FairnessStat } from '../fairnessUtils'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']

export type SidebarTab = 'details' | 'wuensche' | 'fairness' | 'konflikte'

type PlanConflictSummary = {
  conflicts: Array<{ shift_id: number }>
  open_shifts: Array<{ shift_id: number }>
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-sand text-ink',
  warning: 'bg-warn-bg text-warn-ink',
  critical: 'bg-warn text-paper',
}
const SEVERITY_LABEL: Record<string, string> = {
  info: 'Info', warning: 'Warnung', critical: 'Kritisch',
}

const TABS_BESETZUNG: SidebarTab[] = ['details', 'konflikte']
const TABS_INA: SidebarTab[] = ['details', 'wuensche', 'fairness', 'konflikte']
const TAB_LABELS: Record<SidebarTab, string> = {
  details: 'Details', wuensche: 'Wünsche', fairness: 'Fairness', konflikte: 'Konflikte',
}

export interface PlanSidebarProps {
  // KPI
  shifts: ShiftWithDetails[]
  planFrom: string
  planTo: string
  openCount: number
  conflictCount: number
  onConflictBadgeClick: () => void
  // Tabs
  mode: 'besetzung' | 'ina'
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  // Details
  shift?: ShiftWithDetails | null
  onCloseShift?: () => void
  tarifWarnings?: TarifWarning[]
  shiftOverrides?: ConstraintOverride[]
  onCreateOverride?: (constraintId: string, reason: string | null) => void
  onDeleteOverride?: (overrideId: number) => void
  selectedDoctorId?: number | null
  doctors?: Doctor[]
  shiftTypes?: ShiftType[]
  wishes?: Wish[]
  planMonth?: string
  // Wünsche
  showWishes: boolean
  onToggleWishes: () => void
  // Fairness
  fairnessStats: FairnessStat[]
  fairnessGroups: string[]
  // Konflikte
  conflicts?: PlanConflictSummary | null
  onScrollToShift: (shiftId: number) => void
}

export function PlanSidebar({
  shifts, planFrom, planTo, openCount, conflictCount, onConflictBadgeClick,
  mode, activeTab, onTabChange,
  shift, onCloseShift, tarifWarnings, shiftOverrides = [], onCreateOverride, onDeleteOverride,
  selectedDoctorId, doctors = [], shiftTypes = [], wishes = [], planMonth,
  showWishes, onToggleWishes,
  fairnessStats, fairnessGroups,
  conflicts, onScrollToShift,
}: PlanSidebarProps) {
  const [pendingReason, setPendingReason] = useState<Record<string, string>>({})

  const overrideMap = new Map(shiftOverrides.map((o) => [o.constraint_id, o]))
  const isOverridable = (ruleId: string) => (REGULATORISCH_HART_IDS as readonly string[]).includes(ruleId)

  const coverage = useMemo(() => {
    if (shifts.length === 0) return 0
    return Math.round(shifts.filter((s) => s.doctor_id != null).length / shifts.length * 100)
  }, [shifts])

  const sparkline = useMemo(() => {
    try {
      const days = eachDayOfInterval({ start: parseISO(planFrom), end: parseISO(planTo) }).slice(0, 14)
      return days.map((day) => {
        const dk = format(day, 'yyyy-MM-dd')
        const ds = shifts.filter((s) => s.shift_date === dk)
        if (ds.length === 0) return 0
        return Math.round(ds.filter((s) => s.doctor_id != null).length / ds.length * 100)
      })
    } catch { return [] }
  }, [shifts, planFrom, planTo])

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) ?? null
  const doctorShifts = shifts.filter((s) => s.doctor_id === selectedDoctorId)
  const employmentPct = selectedDoctor
    ? (selectedDoctor.employment_periods?.find(
        (ep) => ep.valid_to == null || ep.valid_to >= new Date().toISOString().slice(0, 10),
      )?.employment_percentage ?? null)
    : null

  const shiftTypeBreakdown = shiftTypes
    .map((st) => ({ st, count: doctorShifts.filter((s) => s.shift_type?.id === st.id).length }))
    .filter(({ count }) => count > 0)

  const doctorWishes = wishes.filter((w) => w.doctor_id === selectedDoctorId)

  const tabs = mode === 'besetzung' ? TABS_BESETZUNG : TABS_INA
  const fairnessColTemplate = `1fr ${fairnessGroups.map(() => '2.25rem').join(' ')} 2.25rem`

  return (
    <div className="w-[290px] shrink-0 flex flex-col bg-paper border-l border-line overflow-hidden">
      {/* KPI Strip */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-line bg-card text-[12px] text-ink-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-serif text-[18px] text-ink tabular-nums leading-none">{coverage}%</span>
          {sparkline.length > 0 && (
            <div className="flex items-end gap-0.5 h-[16px]">
              {sparkline.map((v, i) => (
                <div
                  key={i}
                  className={cn('w-[3px] rounded-sm', v < 80 ? 'bg-warn' : 'bg-dp-accent-2')}
                  style={{ height: `${Math.max(3, (v / 100) * 16)}px` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-[16px] text-ink tabular-nums leading-none">{openCount}</span>
          <span className="text-[11px]">offen</span>
        </div>
        <button
          type="button"
          onClick={onConflictBadgeClick}
          className={cn(
            'flex items-baseline gap-1 transition-opacity',
            conflictCount > 0 ? 'hover:opacity-70' : 'cursor-default',
          )}
        >
          <span className={cn(
            'font-serif text-[16px] tabular-nums leading-none',
            conflictCount > 0 ? 'text-warn' : 'text-ink',
          )}>
            {conflictCount}
          </span>
          <span className="text-[11px]">Konflikte</span>
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-line bg-card shrink-0" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'flex-1 px-1 py-2 text-[11px] font-medium transition-colors',
              activeTab === tab
                ? 'text-ink border-b-2 border-accent'
                : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Details ── */}
        {activeTab === 'details' && (
          <div className="p-4 space-y-4">
            {/* Ausgewählt */}
            <div>
              <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Ausgewählt</p>
              {selectedDoctor ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0"
                    style={{ background: '#E8DCC4', color: '#26221C' }}>
                    {selectedDoctor.short_name ?? selectedDoctor.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-serif text-[19px] leading-[1.15] text-ink">{selectedDoctor.name}</p>
                    <p className="text-[12px] text-ink-3 mt-0.5">{employmentPct != null ? `${employmentPct}%` : ''}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-ink-3">Zelle klicken zum Auswählen</p>
              )}
            </div>

            {/* Konflikte & Tarif für gewählten Shift */}
            {shift && (shift.conflicts.length > 0 || (tarifWarnings && tarifWarnings.length > 0)) && (
              <div>
                {shift.conflicts.length > 0 && (
                  <div className="rounded-tile border border-warn-line bg-warn-bg p-[12px_14px] space-y-2">
                    <div className="flex items-center gap-2 text-[12px] font-medium text-warn-ink">
                      <span className="w-4 h-4 rounded-full bg-warn text-white flex items-center justify-center text-[10px] font-bold shrink-0">!</span>
                      {shift.conflicts.length === 1 ? 'Regelkonflikt' : `${shift.conflicts.length} Konflikte`}
                      {shift.shift_date ? ` · ${shift.shift_date}` : ''}
                    </div>
                    {shift.conflicts.map((c, i) => <ConflictCard key={i} conflict={c} />)}
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
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', SEVERITY_CLASS[w.severity] ?? 'bg-sand text-ink')}>
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
                                    <Button size="sm" variant="outline" className="h-6 text-[11px] flex-1"
                                      onClick={() => {
                                        onCreateOverride?.(w.rule_id, pendingReason[w.rule_id] ?? null)
                                        setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n })
                                      }}>
                                      <ShieldOff size={11} className="mr-1" /> Freigeben
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                                      onClick={() => setPendingReason((r) => { const n = { ...r }; delete n[w.rule_id]; return n })}>
                                      ✕
                                    </Button>
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

            {/* Schichten */}
            {selectedDoctor && doctorShifts.length > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-1.5">
                  Schichten {planMonth ?? ''}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-[30px] text-ink tabular-nums leading-none">{doctorShifts.length}</span>
                  <span className="text-[13px] text-ink-3">Dienste</span>
                </div>
                <div className="h-1 bg-line rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-ok rounded-full"
                    style={{ width: `${Math.min(100, (doctorShifts.length / Math.max(1, shifts.length)) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Schichttypen */}
            {selectedDoctor && shiftTypeBreakdown.length > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Schichttypen</p>
                <div className="space-y-1">
                  {shiftTypeBreakdown.map(({ st, count }) => (
                    <div key={st.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center font-semibold text-[11px] shrink-0"
                        style={{ background: '#E8DCC4', color: '#26221C' }}>
                        {st.short_name}
                      </span>
                      <span className="flex-1 text-ink-2">{st.name}</span>
                      <span className="font-serif text-[16px] text-ink tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wünsche Preview */}
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

            {!selectedDoctor && !shift && (
              <div className="flex flex-col items-center justify-center h-40 text-center text-[12px] text-ink-3 gap-2">
                <span>Zelle klicken zum Auswählen</span>
              </div>
            )}

            {shift && onCloseShift && (
              <button type="button" onClick={onCloseShift}
                className="text-[11px] text-ink-3 underline hover:text-ink transition w-full text-left">
                Schicht-Auswahl aufheben ({shift.shift_type?.short_name} · {shift.shift_date})
              </button>
            )}
          </div>
        )}

        {/* ── Konflikte ── */}
        {activeTab === 'konflikte' && (
          <div className="p-4 space-y-4">
            {(conflicts?.conflicts.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Konflikte</p>
                <div className="space-y-1">
                  {conflicts!.conflicts.map((c) => {
                    const s = shifts.find((sh) => sh.id === c.shift_id)
                    return (
                      <button key={c.shift_id} type="button"
                        aria-label={s?.shift_date ?? `Schicht ${c.shift_id}`}
                        onClick={() => onScrollToShift(c.shift_id)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-warn-line bg-warn-bg text-[12px] text-warn-ink hover:opacity-80 transition-opacity">
                        {s?.shift_date ?? `#${c.shift_id}`}
                        {s?.shift_type && <span className="ml-2 font-semibold">{s.shift_type.short_name}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {(conflicts?.open_shifts.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">Offene Dienste</p>
                <div className="space-y-1">
                  {conflicts!.open_shifts.map((c) => {
                    const s = shifts.find((sh) => sh.id === c.shift_id)
                    return (
                      <button key={c.shift_id} type="button"
                        aria-label={s?.shift_date ?? `Schicht ${c.shift_id}`}
                        onClick={() => onScrollToShift(c.shift_id)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-line bg-paper text-[12px] text-ink-2 hover:bg-line/30 transition-colors">
                        {s?.shift_date ?? `#${c.shift_id}`}
                        {s?.shift_type && <span className="ml-2 font-semibold">{s.shift_type.short_name}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {!conflicts?.conflicts.length && !conflicts?.open_shifts.length && (
              <div className="flex flex-col items-center justify-center h-32 text-center text-[12px] text-ink-3">
                <span>Keine Konflikte</span>
              </div>
            )}
          </div>
        )}

        {/* ── Wünsche (INA only) ── */}
        {activeTab === 'wuensche' && (
          <div className="p-4 space-y-4">
            <button type="button" onClick={onToggleWishes}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors w-full',
                showWishes
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-paper border-line text-ink-3 hover:bg-line/40',
              )}>
              <Star className="size-3" />
              Wunsch-Hinweise im Grid {showWishes ? 'ausblenden' : 'einblenden'}
            </button>
            {wishes.length > 0 ? (
              <div>
                <p className="text-[10px] text-ink-3 uppercase tracking-[0.08em] font-medium mb-2">
                  Wünsche ({wishes.length})
                </p>
                <div className="space-y-1">
                  {wishes.map((w) => (
                    <div key={w.id} className="px-3 py-1.5 rounded-lg border border-line bg-paper text-[12px] text-ink-2">
                      {w.wish_date ? (
                        <span>{w.wish_date} → <strong>{w.wish_type === 'AVOID_DAY' ? 'frei' : w.wish_type === 'REQUIRE_SHIFT' ? 'Dienst' : 'kein Dienst'}</strong></span>
                      ) : (
                        <span className="text-ink-3">{w.wish_type}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-ink-3">Keine Wünsche erfasst</p>
            )}
          </div>
        )}

        {/* ── Fairness (INA only) ── */}
        {activeTab === 'fairness' && (
          <div className="flex flex-col overflow-hidden h-full">
            <div className="grid border-b border-line text-[10px] text-ink-3 font-medium bg-paper/40 shrink-0"
              style={{ gridTemplateColumns: fairnessColTemplate }}>
              <div className="px-2 py-1.5">Arzt</div>
              {fairnessGroups.map((g) => (
                <div key={g} className="px-1 py-1.5 text-center truncate" title={g}>{g}</div>
              ))}
              <div className="px-1 py-1.5 text-center">∑</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {fairnessStats.length === 0 ? (
                <div className="px-3 py-4 text-xs text-ink-3 text-center">Keine Ärzte im Plan</div>
              ) : (
                fairnessStats.map((stat) => (
                  <div key={stat.doctorId}
                    className="grid border-b border-line last:border-0 text-xs hover:bg-paper/60 transition-colors"
                    style={{ gridTemplateColumns: fairnessColTemplate }}>
                    <div className="px-2 py-1.5 truncate text-ink" title={stat.doctorName}>
                      {stat.shortName ?? stat.doctorName}
                    </div>
                    {fairnessGroups.map((g) => (
                      <div key={g} className={cn('px-1 py-1.5 text-center tabular-nums', (stat.byGroup[g] ?? 0) > 0 ? 'text-ink' : 'text-ink-3')}>
                        {stat.byGroup[g] ?? 0}
                      </div>
                    ))}
                    <div className={cn('px-1 py-1.5 text-center font-medium tabular-nums', stat.total > 0 ? 'text-ink' : 'text-ink-3')}>
                      {stat.total}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen — erwartet PASS**

```bash
cd frontend && npx vitest run src/features/plans/tests/PlanSidebar.test.tsx
```

Erwartet: alle Tests grün.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/plans/components/PlanSidebar.tsx \
        frontend/src/features/plans/tests/PlanSidebar.test.tsx
git commit -m "feat(plan): PlanSidebar — KPI-Strip + Tabs (Details/Konflikte/Wünsche/Fairness)"
```

---

## Task 3: PlanPage — Integration

**Files:**
- Modify: `frontend/src/features/plans/PlanPage.tsx`

- [ ] **Step 1: Imports aktualisieren**

Ersetze in PlanPage.tsx die folgenden Import-Zeilen:

```typescript
// ENTFERNEN:
import { ShiftTypeDragBar, parseShiftTypeDragId } from './components/ShiftTypeDragBar'
import { AbsenceTypeDragBar, parseAbsenceDragId } from './components/AbsenceTypeDragBar'
import { PlanKpiBar } from './components/PlanKpiBar'
import { ContextPanel } from './components/ContextPanel'
import { FairnessSidebar } from './components/FairnessSidebar'
import { buildFairnessStats } from './fairnessUtils'

// HINZUFÜGEN:
import { parseShiftTypeDragId, parseAbsenceDragId } from './components/PlanModeBar'
import { PlanSidebar } from './components/PlanSidebar'
import type { SidebarTab } from './components/PlanSidebar'
import { buildFairnessStats } from './fairnessUtils'
```

`buildFairnessStats` bleibt, da PlanPage die Stats berechnet und an PlanSidebar weitergibt.

- [ ] **Step 2: State aktualisieren**

Ersetze in PlanPage.tsx:

```typescript
// ENTFERNEN (Zeile ~160):
const [showFairness, setShowFairness] = useState(false)

// HINZUFÜGEN (nach showWishes state, ~Zeile 159):
const [sidebarTab, setSidebarTab] = useState<SidebarTab>('details')
```

- [ ] **Step 3: useEffect für Tab-Reset bei Moduswechsel hinzufügen**

Füge nach dem bestehenden `useEffect` für `solverEnabled` (ca. Zeile 332) ein:

```typescript
useEffect(() => {
  const validBesetzung: SidebarTab[] = ['details', 'konflikte']
  if (mode === 'besetzung' && !validBesetzung.includes(sidebarTab)) {
    setSidebarTab('details')
  }
}, [mode])
```

- [ ] **Step 4: scrollToShift Callback hinzufügen**

Füge nach `scrollToFirstMatch` (ca. Zeile 371) ein:

```typescript
const scrollToShift = useCallback((shiftId: number) => {
  const el = document.querySelector(`[data-shift-id="${shiftId}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('dp-highlight-pulse')
  if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
  highlightTimerRef.current = setTimeout(() => {
    el.classList.remove('dp-highlight-pulse')
    highlightTimerRef.current = null
  }, 2000)
}, [])
```

- [ ] **Step 5: PlanModeBar Props anpassen**

Ersetze den `<PlanModeBar ... />` Block (ca. Zeile 755–773) durch:

```tsx
{plan && (
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
  />
)}
```

- [ ] **Step 6: PlanKpiBar entfernen**

Entferne den gesamten `{plan && (<PlanKpiBar ... />)}` Block (ca. Zeile 774–782).

- [ ] **Step 7: DnD-Bars Block entfernen**

Entferne den gesamten `<div className="px-6 pt-2 pb-1 ...">` Block mit ShiftTypeDragBar und AbsenceTypeDragBar (ca. Zeile 784–793).

- [ ] **Step 8: DoctorDragSource konditional machen**

Ersetze (ca. Zeile 817):

```tsx
// ALT:
<DoctorDragSource
  doctors={doctors}
  ...
/>

// NEU:
{mode === 'besetzung' && (
  <DoctorDragSource
    doctors={doctors}
    rotationDoctorIds={assignedDoctorIds}
    highlightedDoctorId={highlightedDoctorId}
    onHighlightDoctor={setHighlightedDoctorId}
    locked={plan?.besetzung_locked ?? false}
  />
)}
```

- [ ] **Step 9: ContextPanel + FairnessSidebar durch PlanSidebar ersetzen**

Ersetze den Block ab `{showFairness && (<FairnessSidebar .../>)}` bis `<ContextPanel .../>` (ca. Zeile 876–901) durch:

```tsx
{plan && (
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
    shift={contextShift}
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
    conflicts={conflicts}
    onScrollToShift={scrollToShift}
  />
)}
```

- [ ] **Step 10: TypeScript-Kompilierung prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartet: Keine Fehler. Bei Fehlern: Typen anpassen (insbesondere `conflicts`-Typ — falls `usePlanConflicts` andere Felder liefert, die Interface `PlanConflictSummary` in `PlanSidebar.tsx` entsprechend erweitern).

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/plans/PlanPage.tsx
git commit -m "feat(plan): PlanPage — PlanSidebar integriert, DoctorDragSource konditional, alte Blöcke entfernt"
```

---

## Task 4: Cleanup — alte Dateien löschen + Tests bereinigen

**Files:**
- Delete: `frontend/src/features/plans/components/ShiftTypeDragBar.tsx`
- Delete: `frontend/src/features/plans/components/AbsenceTypeDragBar.tsx`
- Delete: `frontend/src/features/plans/components/PlanKpiBar.tsx`
- Delete: `frontend/src/features/plans/components/ContextPanel.tsx`
- Delete: `frontend/src/features/plans/components/FairnessSidebar.tsx`
- Delete: `frontend/src/features/plans/tests/ContextPanel.test.tsx`
- Delete: `frontend/src/features/plans/tests/FairnessSidebar.test.tsx`
- Delete: `frontend/src/features/plans/components/__tests__/PlanKpiBar.test.tsx`

- [ ] **Step 1: Dateien löschen**

```bash
cd frontend/src/features/plans
rm components/ShiftTypeDragBar.tsx
rm components/AbsenceTypeDragBar.tsx
rm components/PlanKpiBar.tsx
rm components/ContextPanel.tsx
rm components/FairnessSidebar.tsx
rm tests/ContextPanel.test.tsx
rm tests/FairnessSidebar.test.tsx
rm components/__tests__/PlanKpiBar.test.tsx
```

- [ ] **Step 2: Prüfen ob weitere Imports diese Dateien referenzieren**

```bash
cd frontend && grep -r "ShiftTypeDragBar\|AbsenceTypeDragBar\|PlanKpiBar\|ContextPanel\|FairnessSidebar" src/ --include="*.tsx" --include="*.ts" -l
```

Erwartet: Keine Treffer. Falls Treffer: Imports in gefundenen Dateien entfernen.

- [ ] **Step 3: Gesamtes Test-Suite laufen lassen**

```bash
cd frontend && npx vitest run src/features/plans/
```

Erwartet: Alle Tests grün, keine importbezogenen Fehler.

- [ ] **Step 4: TypeScript-Abschluss-Check**

```bash
cd frontend && npx tsc --noEmit
```

Erwartet: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(plan): lösche obsolete Komponenten (ShiftTypeDragBar, AbsenceTypeDragBar, PlanKpiBar, ContextPanel, FairnessSidebar) + Tests"
```

---

## Spec Coverage Check

| Spec-Anforderung | Task |
|-----------------|------|
| DnD-Chips in ModeBar (beide Modi, Dienste + Abwesenheiten) | Task 1 |
| Separate DnD-Bars entfallen | Task 3 Steps 6–7, Task 4 |
| Fokus-Filter in ModeBar | Task 1 |
| KpiBar entfällt, KPIs in Sidebar | Task 2 (KPI-Strip), Task 3 Step 6 |
| Arzt-Sidebar nur Besetzungs-Modus | Task 3 Step 8 |
| Rechte Sidebar = Tab-Panel | Task 2 |
| Tabs modusspezifisch (B: Details+Konflikte, INA: +Wünsche+Fairness) | Task 2 |
| KPI-Klick auf Konflikte → Tab wechseln | Task 2 (onConflictBadgeClick), Task 3 Step 9 |
| Details-Tab = ContextPanel-Inhalt | Task 2 |
| Konflikte-Tab = Liste + scrollToShift | Task 2, Task 3 Step 4 |
| Wünsche-Tab = Toggle + Liste | Task 2 |
| Fairness-Tab = Tabelle | Task 2 |
| Tab-Reset bei Moduswechsel | Task 3 Step 3 |
| Helpers exportiert aus PlanModeBar | Task 1 |
