import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ShiftTypeListPage } from '../ShiftTypeListPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))
vi.mock('../useShiftTypes', () => ({
  useShiftTypes: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteShiftType: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateShiftType: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateShiftType: () => ({ mutate: vi.fn(), isPending: false }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => { vi.clearAllMocks() })

describe('ShiftTypeListPage – Smoke', () => {
  it('rendert ohne Crash', () => {
    render(<Wrapper><ShiftTypeListPage /></Wrapper>)
    expect(screen.getByText('Schichttypen')).toBeInTheDocument()
  })

  it('zeigt CommandBar mit Primär-Button', () => {
    render(<Wrapper><ShiftTypeListPage /></Wrapper>)
    expect(screen.getAllByRole('button', { name: /neuer schichttyp/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt Empty-State bei leerer Liste', () => {
    render(<Wrapper><ShiftTypeListPage /></Wrapper>)
    expect(screen.getByText(/keine schichttypen/i)).toBeInTheDocument()
  })
})
