import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { PlanListPage } from '../PlanListPage'
import type { Plan } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

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

vi.mock('../useDeletePlan', () => ({
  useDeletePlan: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../useUpdatePlan', () => ({
  useUpdatePlan: () => ({ mutate: vi.fn(), isPending: false }),
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
    expect(screen.getAllByText('Entwurf').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Freigegeben').length).toBeGreaterThan(0)
  })

  it('zeigt Status-Optionen im Dropdown-Menü', async () => {
    const user = userEvent.setup()
    render(<Wrapper><PlanListPage /></Wrapper>)
    const buttons = screen.getAllByRole('button', { name: 'Plan-Aktionen' })
    await user.click(buttons[0]) // erster Plan ist DRAFT
    expect(screen.getByText('Freigeben')).toBeInTheDocument()
    expect(screen.getByText('Archivieren')).toBeInTheDocument()
    expect(screen.getByText('Löschen')).toBeInTheDocument()
  })

  it('öffnet PlanCreateDialog bei Klick auf + Neuer Plan', async () => {
    const user = userEvent.setup()
    render(<Wrapper><PlanListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: '+ Neuer Plan' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
