import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { QualificationListPage } from '../QualificationListPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('../useQualifications', () => ({
  useQualifications: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteQualification: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateQualification: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateQualification: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/api', () => ({ ApiError: class ApiError extends Error {} }))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => { vi.clearAllMocks() })

describe('QualificationListPage – Smoke', () => {
  it('rendert ohne Crash', () => {
    render(<Wrapper><QualificationListPage /></Wrapper>)
    expect(screen.getByText('Qualifikationen')).toBeInTheDocument()
  })

  it('zeigt CommandBar mit Primär-Button', () => {
    render(<Wrapper><QualificationListPage /></Wrapper>)
    expect(screen.getAllByRole('button', { name: /neue qualifikation/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt Empty-State bei leerer Liste', () => {
    render(<Wrapper><QualificationListPage /></Wrapper>)
    expect(screen.getByText(/keine qualifikationen/i)).toBeInTheDocument()
  })
})
