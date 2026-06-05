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
