import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RuleOverrideListPage } from '../RuleOverrideListPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../useRuleOverrides', () => ({
  useRuleOverrides: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteRuleOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateRuleOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateRuleOverride: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/doctors/useDoctors', () => ({
  useDoctors: () => ({ data: [] }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => { vi.clearAllMocks() })

describe('RuleOverrideListPage – Smoke', () => {
  it('rendert ohne Crash', () => {
    render(<Wrapper><RuleOverrideListPage /></Wrapper>)
    expect(screen.getByText('Sonderregelungen')).toBeInTheDocument()
  })

  it('zeigt CommandBar mit Primär-Button', () => {
    render(<Wrapper><RuleOverrideListPage /></Wrapper>)
    // Bei leerer Liste erscheint der Button in CommandBar und Empty-State (beide korrekt)
    expect(screen.getAllByRole('button', { name: /neue sonderregelung/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt Empty-State bei leerer Liste', () => {
    render(<Wrapper><RuleOverrideListPage /></Wrapper>)
    expect(screen.getByText(/keine sonderregelungen/i)).toBeInTheDocument()
  })
})
