import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanGrid } from '../components/PlanGrid'
import type { ShiftWithDetails, Doctor } from '@/lib/types'

const ST = {
  id: 1, name: 'Frühdienst', short_name: 'F',
  applies_on_weekdays: true, applies_on_weekend: false,
  start_time: null, end_time: null, display_order: 0,
  active: true, notes: null, created_at: '', updated_at: '',
}

const doctor: Doctor = {
  id: 1, name: 'Müller, Anna', short_name: 'AM',
  doctor_type: 'INTERNAL', is_facharzt: true,
  active: true, weiterbildungsjahr: null,
  entry_date: null, virtual_entry_date: null, notes: null,
  created_at: '', updated_at: '', employment_periods: [], qualifications: [],
}

function makeShift(overrides: Partial<ShiftWithDetails>): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-01',
    shift_type_id: 1, doctor_id: 1, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: ST, doctor: null, conflicts: [],
    ...overrides,
  }
}

describe('PlanGrid', () => {
  it('zeigt Arztname in der linken Spalte', () => {
    render(
      <PlanGrid
        shifts={[]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('Müller, Anna')).toBeInTheDocument()
  })

  it('zeigt Schichtcode in der Zelle wenn Arzt zugewiesen', () => {
    const shift = makeShift({ doctor_id: 1, shift_date: '2026-05-01' })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('rendert Warn-Dot (!) bei Konfliktzelle', () => {
    const shift = makeShift({
      doctor_id: 1, shift_date: '2026-05-01',
      conflicts: [{
        shift_id: 1, conflict_type: 'not_available', message: 'Im Urlaub',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-01', shift_type_short_name: 'F',
      }],
    })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('!')).toBeInTheDocument()
  })

  it('ruft onCellClick mit shiftId und doctorId auf', async () => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    const shift = makeShift({ id: 42, doctor_id: 1, shift_date: '2026-05-01' })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={onCellClick} onConflictDotClick={vi.fn()}
      />
    )
    await user.click(screen.getByText('F'))
    expect(onCellClick).toHaveBeenCalledWith(42, 1, '2026-05-01')
  })

  it('rendert Header mit Tageszahlen 1 und 31', () => {
    render(
      <PlanGrid
        shifts={[]} doctors={[]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('ruft onConflictDotClick mit shift auf bei Warn-Dot-Click', async () => {
    const user = userEvent.setup()
    const onConflictDotClick = vi.fn()
    const shift = makeShift({
      id: 42, doctor_id: 1, shift_date: '2026-05-01',
      conflicts: [{
        shift_id: 42, conflict_type: 'not_available', message: 'Im Urlaub',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-01', shift_type_short_name: 'F',
      }],
    })
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={onConflictDotClick}
      />
    )
    await user.click(screen.getByText('!'))
    expect(onConflictDotClick).toHaveBeenCalledWith(shift)
  })
})
