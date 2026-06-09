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
