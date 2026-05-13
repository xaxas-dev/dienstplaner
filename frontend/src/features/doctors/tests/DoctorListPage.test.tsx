import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DoctorListPage } from '../DoctorListPage'
import type { Doctor } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const mockDoctors: Doctor[] = [
  {
    id: 1, name: 'Anna Facharzt', short_name: 'AF', doctor_type: 'INTERNAL',
    is_facharzt: true, weiterbildungsjahr: null, active: true,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  },
  {
    id: 2, name: 'Bruno WBA', short_name: 'BW', doctor_type: 'INTERNAL',
    is_facharzt: false, weiterbildungsjahr: 2, active: true,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  },
  {
    id: 3, name: 'Clara Extern', short_name: 'CE', doctor_type: 'EXTERNAL',
    is_facharzt: false, weiterbildungsjahr: null, active: true,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  },
]

vi.mock('../useDoctors', () => ({
  useDoctors: () => ({ data: mockDoctors, isLoading: false, isError: false, refetch: vi.fn() }),
  useDeleteDoctor: () => ({ mutate: vi.fn(), isPending: false }),
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

describe('DoctorListPage – Karten-Grid', () => {
  it('zeigt alle Ärzte bei Filter Alle', () => {
    render(<Wrapper><DoctorListPage /></Wrapper>)
    expect(screen.getByText('Anna Facharzt')).toBeInTheDocument()
    expect(screen.getByText('Bruno WBA')).toBeInTheDocument()
    expect(screen.getByText('Clara Extern')).toBeInTheDocument()
  })

  it('CommandBar zeigt Arzt-Anzahl im Titel', () => {
    render(<Wrapper><DoctorListPage /></Wrapper>)
    expect(screen.getByText(/3 Ärzte/)).toBeInTheDocument()
  })

  it('Filter Fachärzte zeigt nur Fachärzte', async () => {
    const user = userEvent.setup()
    render(<Wrapper><DoctorListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: 'Fachärzte' }))
    expect(screen.getByText('Anna Facharzt')).toBeInTheDocument()
    expect(screen.queryByText('Bruno WBA')).toBeNull()
    expect(screen.queryByText('Clara Extern')).toBeNull()
  })

  it('Filter WBA zeigt nur WBA-Ärzte', async () => {
    const user = userEvent.setup()
    render(<Wrapper><DoctorListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: 'WBA' }))
    expect(screen.queryByText('Anna Facharzt')).toBeNull()
    expect(screen.getByText('Bruno WBA')).toBeInTheDocument()
    expect(screen.queryByText('Clara Extern')).toBeNull()
  })

  it('Filter Extern zeigt nur externe Ärzte', async () => {
    const user = userEvent.setup()
    render(<Wrapper><DoctorListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: 'Extern' }))
    expect(screen.queryByText('Anna Facharzt')).toBeNull()
    expect(screen.queryByText('Bruno WBA')).toBeNull()
    expect(screen.getByText('Clara Extern')).toBeInTheDocument()
  })

  it('Filter Alle stellt alle Ärzte wieder her', async () => {
    const user = userEvent.setup()
    render(<Wrapper><DoctorListPage /></Wrapper>)
    await user.click(screen.getByRole('button', { name: 'Fachärzte' }))
    await user.click(screen.getByRole('button', { name: 'Alle' }))
    expect(screen.getByText('Anna Facharzt')).toBeInTheDocument()
    expect(screen.getByText('Bruno WBA')).toBeInTheDocument()
    expect(screen.getByText('Clara Extern')).toBeInTheDocument()
  })
})
