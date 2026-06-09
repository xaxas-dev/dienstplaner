import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, test, expect, describe } from 'vitest'
import { PlanModeBar } from '../PlanModeBar'

const mockShiftTypes = [
  {
    id: 1,
    name: 'Vortagsdienst',
    short_name: 'V',
    display_order: 0,
    active: true,
    applies_on_weekdays: true,
    applies_on_weekend: false,
    is_bereitschaftsdienst: false,
    filter_group: 'INA',
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  },
  {
    id: 2,
    name: 'Nachtdienst',
    short_name: 'N',
    display_order: 1,
    active: true,
    applies_on_weekdays: true,
    applies_on_weekend: true,
    is_bereitschaftsdienst: false,
    filter_group: 'INA',
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
  },
]

const base = {
  mode: 'besetzung' as const,
  onModeChange: vi.fn(),
  conflictCount: 0,
  onScrollToConflict: vi.fn(),
  shiftTypes: mockShiftTypes,
  activeFilterGroups: new Set<string>(),
  onFilterGroupToggle: vi.fn(),
  onFilterGroupClear: vi.fn(),
  showWishes: false,
  onToggleWishes: vi.fn(),
  wishCount: 0,
  showFairness: false,
  onToggleFairness: vi.fn(),
  solverEnabled: false,
  isSolving: false,
  onSolve: vi.fn(),
}

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

describe('INA-Modus Toggles', () => {
  test('Wünsche-Toggle klickbar → onToggleWishes aufgerufen', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="ina" />)
    await user.click(screen.getByText('Wünsche'))
    expect(base.onToggleWishes).toHaveBeenCalledOnce()
  })

  test('Fairness-Toggle klickbar → onToggleFairness aufgerufen', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} mode="ina" />)
    await user.click(screen.getByText('Fairness'))
    expect(base.onToggleFairness).toHaveBeenCalledOnce()
  })
})

describe('Konflikte-Badge', () => {
  test('bei conflictCount > 0 sichtbar', () => {
    render(<PlanModeBar {...base} conflictCount={3} />)
    expect(screen.getByText('3 Konflikte')).toBeInTheDocument()
  })

  test('bei conflictCount = 0 nicht sichtbar', () => {
    render(<PlanModeBar {...base} conflictCount={0} />)
    expect(screen.queryByText(/Konflikte/)).not.toBeInTheDocument()
  })

  test('Klick auf Badge ruft onScrollToConflict auf', async () => {
    const user = userEvent.setup()
    render(<PlanModeBar {...base} conflictCount={2} />)
    await user.click(screen.getByText('2 Konflikte'))
    expect(base.onScrollToConflict).toHaveBeenCalledOnce()
  })
})
