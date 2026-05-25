import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DepartmentListPage } from '../DepartmentListPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))
vi.mock('../useDepartments', () => ({
  useDepartments: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteDepartment: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateDepartment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDepartment: () => ({ mutate: vi.fn(), isPending: false }),
}))

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

beforeEach(() => { vi.clearAllMocks() })

describe('DepartmentListPage – Smoke', () => {
  it('rendert ohne Crash', () => {
    render(<Wrapper><DepartmentListPage /></Wrapper>)
    expect(screen.getByText('Stationen')).toBeInTheDocument()
  })

  it('zeigt CommandBar mit Primär-Button', () => {
    render(<Wrapper><DepartmentListPage /></Wrapper>)
    expect(screen.getAllByRole('button', { name: /neue station/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt Empty-State bei leerer Liste', () => {
    render(<Wrapper><DepartmentListPage /></Wrapper>)
    expect(screen.getByText(/keine stationen/i)).toBeInTheDocument()
  })
})
