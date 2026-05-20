import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { RotationAssignPopover } from '../components/RotationAssignPopover'
import type { Doctor, RotationAssignmentWithDetails } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('../usePlanRotations', () => ({
  useCreateRotation: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateRotation: () => ({ mutate: mockUpdate, isPending: false }),
  useDeleteRotation: () => ({ mutate: mockDelete, isPending: false }),
}))

const mockDoctors: Doctor[] = [
  {
    id: 1,
    name: 'Dr. Test',
    short_name: 'DT',
    doctor_type: 'INTERNAL',
    is_facharzt: true,
    active: true,
    weiterbildungsjahr: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    created_at: '',
    updated_at: '',
    employment_periods: [],
    qualifications: [],
  },
  {
    id: 2,
    name: 'Dr. Zwei',
    short_name: 'DZ',
    doctor_type: 'INTERNAL',
    is_facharzt: false,
    active: true,
    weiterbildungsjahr: null,
    entry_date: null,
    virtual_entry_date: null,
    notes: null,
    created_at: '',
    updated_at: '',
    employment_periods: [],
    qualifications: [],
  },
]

vi.mock('@/features/doctors/useDoctors', () => ({
  useDoctors: () => ({ data: mockDoctors, isLoading: false }),
}))

function makeExisting(overrides?: Partial<RotationAssignmentWithDetails>): RotationAssignmentWithDetails {
  return {
    id: 42,
    plan_id: 1,
    doctor_id: 1,
    department_id: 10,
    valid_from: '2026-05-01',
    valid_to: '2026-05-31',
    is_einarbeitung: false,
    notes: null,
    created_at: '',
    updated_at: '',
    doctor: null,
    department: null,
    ...overrides,
  }
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const defaultProps = {
  planId: 1,
  departmentId: 10,
  departmentName: 'Neurologie',
  day: '2026-05-15',
  validFrom: '2026-05-01',
  validTo: '2026-05-31',
  existingAssignment: null,
  blocksIna: false,
  onClose: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RotationAssignPopover', () => {
  it('zeigt Arztliste und Datumsfelder', () => {
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} />
      </Wrapper>,
    )
    expect(screen.getByText('Dr. Test')).toBeInTheDocument()
    expect(screen.getByText('Dr. Zwei')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-05-15')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-05-31')).toBeInTheDocument()
  })

  it('Arzt auswählen und Speichern ruft useCreateRotation auf', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} onClose={onClose} />
      </Wrapper>,
    )
    await user.click(screen.getByText('Dr. Test'))
    await user.click(screen.getByText('Speichern'))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 1,
        doctor_id: 1,
        department_id: 10,
      }),
      expect.anything(),
    )
  })

  it('Speichern mit existingAssignment ruft useUpdateRotation auf', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <RotationAssignPopover
          {...defaultProps}
          existingAssignment={makeExisting()}
          onClose={onClose}
        />
      </Wrapper>,
    )
    await user.click(screen.getByText('Dr. Test'))
    await user.click(screen.getByText('Speichern'))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        rotationId: 42,
        data: expect.objectContaining({ doctor_id: 1 }),
      }),
      expect.anything(),
    )
  })

  it('zeigt Entfernen-Button nur wenn existingAssignment vorhanden', () => {
    const { rerender } = render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} existingAssignment={null} />
      </Wrapper>,
    )
    expect(screen.queryByText(/Zuordnung entfernen/)).not.toBeInTheDocument()

    rerender(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} existingAssignment={makeExisting()} />
      </Wrapper>,
    )
    expect(screen.getByText(/Zuordnung entfernen/)).toBeInTheDocument()
  })

  it('Klick auf Entfernen ruft useDeleteRotation auf', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} existingAssignment={makeExisting()} />
      </Wrapper>,
    )
    await user.click(screen.getByText(/Zuordnung entfernen/))
    expect(mockDelete).toHaveBeenCalledWith(42, expect.anything())
  })

  it('schließt bei Klick außerhalb', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} onClose={onClose} />
      </Wrapper>,
    )
    await user.click(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('schließt bei Escape-Taste', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} onClose={onClose} />
      </Wrapper>,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('zeigt INA-Hinweis wenn blocksIna=true', () => {
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} blocksIna={true} />
      </Wrapper>,
    )
    expect(
      screen.getByText(/Rotation in diesem Bereich sperrt INA-Dienste/),
    ).toBeInTheDocument()
  })

  it('zeigt keinen INA-Hinweis wenn blocksIna=false', () => {
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} blocksIna={false} />
      </Wrapper>,
    )
    expect(
      screen.queryByText(/Rotation in diesem Bereich sperrt INA-Dienste/),
    ).not.toBeInTheDocument()
  })

  it('preselectedDoctorId aktiviert Speichern direkt ohne manuelle Auswahl', () => {
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} preselectedDoctorId={1} />
      </Wrapper>,
    )
    expect(screen.getByText('Speichern')).not.toBeDisabled()
  })

  it('preselectedDoctorId übermittelt vorausgewählten Arzt beim Speichern', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <RotationAssignPopover {...defaultProps} preselectedDoctorId={2} />
      </Wrapper>,
    )
    await user.click(screen.getByText('Speichern'))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ doctor_id: 2 }),
      expect.anything(),
    )
  })
})
