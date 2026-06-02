import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContextPanel } from '../components/ContextPanel'
import type { components } from '@/lib/api-types'

type ShiftWithDetails = components['schemas']['ShiftWithDetails']
type ShiftTypeResponse = components['schemas']['ShiftTypeResponse']
type DoctorResponse = components['schemas']['DoctorResponse']

const ST: ShiftTypeResponse = {
  id: 1,
  name: 'Frühdienst',
  short_name: 'F',
  applies_on_weekdays: true,
  applies_on_weekend: false,
  start_time: null,
  end_time: null,
  display_order: 0,
  active: true,
  notes: null,
  is_bereitschaftsdienst: false,
  created_at: '',
  updated_at: '',
}

const DOCTOR: DoctorResponse = {
  id: 1,
  name: 'Müller, Anna',
  short_name: 'AM',
  doctor_type: 'INTERNAL',
  is_facharzt: true,
  active: true,
  weiterbildungsjahr: null,
  entry_date: null,
  virtual_entry_date: null,
  notes: null,
  created_at: '',
  updated_at: '',
}

function makeShiftWithConflicts(): ShiftWithDetails {
  return {
    id: 1,
    plan_id: 1,
    shift_date: '2026-05-15',
    shift_type_id: 1,
    doctor_id: 1,
    is_pinned: false,
    is_locked: false,
    notes: null,
    created_at: '',
    updated_at: '',
    shift_type: ST,
    doctor: DOCTOR,
    conflicts: [
      {
        shift_id: 1,
        conflict_type: 'not_available',
        message: 'Arzt hat Urlaub an diesem Tag.',
        doctor_id: 1,
        doctor_name: 'Müller, Anna',
        shift_date: '2026-05-15',
        shift_type_short_name: 'F',
      },
      {
        shift_id: 1,
        conflict_type: 'double_booked',
        message: 'Mehrfachzuweisung am 15.05.',
        doctor_id: 1,
        doctor_name: 'Müller, Anna',
        shift_date: '2026-05-15',
        shift_type_short_name: 'F',
      },
    ],
  }
}

describe('ContextPanel', () => {
  it('zeigt alle Konflikt-Nachrichten', () => {
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={vi.fn()} />)
    expect(screen.getByText('Arzt hat Urlaub an diesem Tag.')).toBeInTheDocument()
    expect(screen.getByText('Mehrfachzuweisung am 15.05.')).toBeInTheDocument()
  })

  it('zeigt Konflikttyp-Badge für jeden Konflikt', () => {
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={vi.fn()} />)
    expect(screen.getByText('NOT_AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('DOUBLE_BOOKED')).toBeInTheDocument()
  })

  it('ruft onClose bei ×-Klick auf', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ContextPanel shift={makeShiftWithConflicts()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /schließen/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
