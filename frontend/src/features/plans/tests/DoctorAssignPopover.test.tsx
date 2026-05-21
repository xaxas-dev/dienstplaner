import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DoctorAssignPopover } from '../components/DoctorAssignPopover'
import type { Doctor, ShiftWithDetails } from '@/lib/types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Default: all doctors available — overridden per test as needed
const mockAvailabilityMap: Record<number, { date: string; available: boolean; reasons: string[] }> = {}

vi.mock('../useAvailabilityForDate', () => ({
  useAvailabilityForDate: () => mockAvailabilityMap,
}))

const mockDoctors: Doctor[] = [
  {
    id: 1, name: 'Müller, Anna', short_name: 'AM',
    doctor_type: 'INTERNAL', is_facharzt: true,
    active: true, weiterbildungsjahr: null,
    entry_date: null, virtual_entry_date: null, notes: null,
    created_at: '', updated_at: '', employment_periods: [], qualifications: [],
  },
]

const mockMutate = vi.fn()

vi.mock('@/features/doctors/useDoctors', () => ({
  useDoctors: () => ({ data: mockDoctors, isLoading: false }),
}))

vi.mock('../useAssignShift', () => ({
  useAssignShift: () => ({ mutate: mockMutate, isPending: false }),
}))

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

function makeOpenShift(id: number, shortName: string): ShiftWithDetails {
  return {
    id, plan_id: 1, shift_date: '2026-05-15',
    shift_type_id: id, doctor_id: null, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: { ...ST, id, name: shortName, short_name: shortName },
    doctor: null, conflicts: [],
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

beforeEach(() => {
  vi.clearAllMocks()
  // Reset availability map to empty (all doctors available by default)
  for (const key of Object.keys(mockAvailabilityMap)) {
    delete mockAvailabilityMap[Number(key)]
  }
})

describe('DoctorAssignPopover', () => {
  it('zeigt offene Schichttypen zur Auswahl', () => {
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null}
          openShiftsForDay={[makeOpenShift(1, 'F'), makeOpenShift(2, 'N')]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    expect(screen.getByText('F')).toBeInTheDocument()
    expect(screen.getByText('N')).toBeInTheDocument()
  })

  it('ruft PATCH mit doctor_id auf beim Zuweisen', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null}
          openShiftsForDay={[makeOpenShift(1, 'F')]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    await user.click(screen.getByText('F'))
    expect(mockMutate).toHaveBeenCalledWith(
      { shiftId: 1, data: { doctor_id: 1 } },
      expect.anything(),
    )
  })

  it('zeigt "Zuweisung entfernen" bei besetzter Zelle', () => {
    const occupied: ShiftWithDetails = { ...makeOpenShift(1, 'F'), doctor_id: 1 }
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={occupied}
          openShiftsForDay={[]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    expect(screen.getByText(/Zuweisung entfernen/)).toBeInTheDocument()
  })

  it('ruft PATCH mit doctor_id=null beim Entfernen auf', async () => {
    const user = userEvent.setup()
    const occupied: ShiftWithDetails = { ...makeOpenShift(1, 'F'), doctor_id: 1 }
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={occupied}
          openShiftsForDay={[]}
          onClose={vi.fn()}
        />
      </Wrapper>
    )
    await user.click(screen.getByText(/Zuweisung entfernen/))
    expect(mockMutate).toHaveBeenCalledWith(
      { shiftId: 1, data: { doctor_id: null } },
      expect.anything(),
    )
  })

  it('schließt bei Klick außerhalb', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null} openShiftsForDay={[]}
          onClose={onClose}
        />
      </Wrapper>
    )
    await user.click(document.body)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('schließt bei Escape-Taste', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Wrapper>
        <DoctorAssignPopover
          planId={1} doctorId={1} day="2026-05-15"
          currentShift={null} openShiftsForDay={[]}
          onClose={onClose}
        />
      </Wrapper>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  describe('Availability-Marker', () => {
    const occupied: ShiftWithDetails = { ...makeOpenShift(1, 'F'), doctor_id: 1 }

    it('zeigt keinen Marker wenn Arzt verfügbar ist', () => {
      // mockAvailabilityMap leer → available undefined → kein Marker
      render(
        <Wrapper>
          <DoctorAssignPopover
            planId={1} doctorId={1} day="2026-05-15"
            currentShift={occupied}
            openShiftsForDay={[]}
            onClose={vi.fn()}
          />
        </Wrapper>
      )
      expect(screen.queryByLabelText('Nicht INA-verfügbar')).not.toBeInTheDocument()
    })

    it('zeigt amber Dot wenn Arzt nicht INA-verfügbar ist', () => {
      mockAvailabilityMap[1] = {
        date: '2026-05-15',
        available: false,
        reasons: ['Abwesenheit'],
      }
      render(
        <Wrapper>
          <DoctorAssignPopover
            planId={1} doctorId={1} day="2026-05-15"
            currentShift={occupied}
            openShiftsForDay={[]}
            onClose={vi.fn()}
          />
        </Wrapper>
      )
      expect(screen.getByLabelText('Nicht INA-verfügbar')).toBeInTheDocument()
    })

    it('zeigt keinen Marker wenn available=true', () => {
      mockAvailabilityMap[1] = {
        date: '2026-05-15',
        available: true,
        reasons: [],
      }
      render(
        <Wrapper>
          <DoctorAssignPopover
            planId={1} doctorId={1} day="2026-05-15"
            currentShift={occupied}
            openShiftsForDay={[]}
            onClose={vi.fn()}
          />
        </Wrapper>
      )
      expect(screen.queryByLabelText('Nicht INA-verfügbar')).not.toBeInTheDocument()
    })

    it('Auswahl bleibt möglich trotz Nicht-Verfügbarkeit', async () => {
      const user = userEvent.setup()
      mockAvailabilityMap[1] = {
        date: '2026-05-15',
        available: false,
        reasons: ['Rotation blockiert'],
      }
      render(
        <Wrapper>
          <DoctorAssignPopover
            planId={1} doctorId={1} day="2026-05-15"
            currentShift={occupied}
            openShiftsForDay={[]}
            onClose={vi.fn()}
          />
        </Wrapper>
      )
      await user.click(screen.getByText('Müller, Anna'))
      expect(mockMutate).toHaveBeenCalledWith(
        { shiftId: 1, data: { doctor_id: 1 } },
        expect.anything(),
      )
    })

    it('zeigt Tooltip mit Gründen bei Nicht-Verfügbarkeit', () => {
      mockAvailabilityMap[1] = {
        date: '2026-05-15',
        available: false,
        reasons: ['Abwesenheit', 'INA-Ausschluss'],
      }
      render(
        <Wrapper>
          <DoctorAssignPopover
            planId={1} doctorId={1} day="2026-05-15"
            currentShift={occupied}
            openShiftsForDay={[]}
            onClose={vi.fn()}
          />
        </Wrapper>
      )
      const btn = screen.getByRole('button', { name: /Müller, Anna/ })
      expect(btn).toHaveAttribute('title', 'Abwesenheit, INA-Ausschluss')
    })
  })
})
