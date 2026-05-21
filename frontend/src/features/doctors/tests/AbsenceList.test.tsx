import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AbsenceList } from '../AbsenceList'
import type { Absence } from '@/lib/types'

afterEach(cleanup)

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockMutate = vi.fn()

vi.mock('../useAbsences', () => ({
  useAbsences: vi.fn(),
  useDeleteAbsence: () => ({ mutate: mockMutate, isPending: false }),
  useCreateAbsence: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateAbsence: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { useAbsences } from '../useAbsences'

const mockUseAbsences = vi.mocked(useAbsences)

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const absences: Absence[] = [
  {
    id: 1,
    doctor_id: 1,
    absence_type: 'URLAUB',
    valid_from: '2026-01-10',
    valid_to: '2026-01-20',
    notes: 'Jahresurlaub',
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    doctor_id: 1,
    absence_type: 'KRANKHEIT',
    valid_from: '2026-03-01',
    valid_to: '2026-03-05',
    notes: null,
    created_at: '',
    updated_at: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AbsenceList – Empty-State', () => {
  it('zeigt Empty-State wenn keine Abwesenheiten vorhanden sind', () => {
    mockUseAbsences.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useAbsences>)
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    expect(screen.getByText(/Keine Abwesenheiten hinterlegt/i)).toBeInTheDocument()
  })

  it('zeigt Lade-Indikator während des Ladens', () => {
    mockUseAbsences.mockReturnValue({ data: [], isLoading: true } as unknown as ReturnType<typeof useAbsences>)
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    expect(screen.getByText(/Laden/i)).toBeInTheDocument()
  })
})

describe('AbsenceList – Einträge', () => {
  beforeEach(() => {
    mockUseAbsences.mockReturnValue({
      data: absences,
      isLoading: false,
    } as unknown as ReturnType<typeof useAbsences>)
  })

  it('zeigt beide Abwesenheiten an', () => {
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    expect(screen.getByText('Urlaub')).toBeInTheDocument()
    expect(screen.getByText('Krankheit')).toBeInTheDocument()
  })

  it('zeigt Notizen wenn vorhanden', () => {
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    expect(screen.getByText('Jahresurlaub')).toBeInTheDocument()
  })

  it('Edit-Button öffnet den Dialog', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    const editButtons = screen.getAllByRole('button', { name: /Bearbeiten/i })
    expect(editButtons.length).toBe(2)
    await user.click(editButtons[0])
    expect(screen.getByText('Abwesenheit bearbeiten')).toBeInTheDocument()
  })

  it('Delete-Button öffnet den Bestätigungs-Dialog', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    const deleteButtons = screen.getAllByRole('button', { name: /Löschen/i })
    // First button is the "Löschen" icon button in the list
    await user.click(deleteButtons[0])
    expect(screen.getByText(/Abwesenheit löschen\?/i)).toBeInTheDocument()
  })
})

describe('AbsenceList – Neue Abwesenheit', () => {
  beforeEach(() => {
    mockUseAbsences.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useAbsences>)
  })

  it('Button "Neue Abwesenheit" öffnet den Dialog', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <AbsenceList doctorId={1} />
      </Wrapper>,
    )
    await user.click(screen.getByRole('button', { name: /Neue Abwesenheit/i }))
    // Dialog title is an h2 inside the dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
