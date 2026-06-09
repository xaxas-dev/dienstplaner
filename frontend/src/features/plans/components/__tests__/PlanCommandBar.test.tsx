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
  mode: 'besetzung' as const,
  prevPlan: null,
  nextPlan: null,
  plan: mockPlan,
  onNavigatePrev: vi.fn(),
  onNavigateNext: vi.fn(),
  onNachtwocheClick: vi.fn(),
  onSettingsClick: vi.fn(),
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

test('Einstellungen-Icon vorhanden und klickbar', async () => {
  const user = userEvent.setup()
  render(<PlanCommandBar {...base} />)
  const btn = screen.getByLabelText('Einstellungen')
  await user.click(btn)
  expect(base.onSettingsClick).toHaveBeenCalledOnce()
})

test('Nachtwoche-Button nur im Besetzungs-Modus sichtbar', () => {
  const { rerender } = render(<PlanCommandBar {...base} mode="besetzung" />)
  expect(screen.getByText('Nachtwoche')).toBeInTheDocument()
  rerender(<PlanCommandBar {...base} mode="ina" />)
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
