import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanGrid } from '../components/PlanGrid'
import type { ShiftWithDetails, Doctor, TarifWarning } from '@/lib/types'

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

function makeShift(overrides: Partial<ShiftWithDetails> = {}): ShiftWithDetails {
  return {
    id: 1, plan_id: 1, shift_date: '2026-05-01',
    shift_type_id: 1, doctor_id: 1, is_pinned: false,
    notes: null, created_at: '', updated_at: '',
    shift_type: ST, doctor: null, conflicts: [],
    ...overrides,
  }
}

function makeTarifWarning(shiftId: number): TarifWarning {
  return {
    shift_id: shiftId,
    doctor_id: null,
    shift_date: null,
    rule_id: 'test-rule',
    severity: 'warning',
    message: 'Test-Tarif-Warnung',
  }
}

describe('PlanGrid — TarifWarnings', () => {
  it('zeigt keinen Sand-Dot (§) ohne tarifWarnings', () => {
    const shift = makeShift()
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
      />
    )
    expect(screen.queryByText('§')).not.toBeInTheDocument()
  })

  it('zeigt Sand-Dot (§) wenn tarifWarnings für shift_id vorhanden', () => {
    const shift = makeShift({ id: 7 })
    const warnings: Record<number, TarifWarning[]> = { 7: [makeTarifWarning(7)] }
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
        tarifWarnings={warnings}
      />
    )
    expect(screen.getByText('§')).toBeInTheDocument()
  })

  it('zeigt keinen Sand-Dot wenn tarifWarnings leer für shift_id', () => {
    const shift = makeShift({ id: 7 })
    const warnings: Record<number, TarifWarning[]> = { 7: [] }
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
        tarifWarnings={warnings}
      />
    )
    expect(screen.queryByText('§')).not.toBeInTheDocument()
  })

  it('ruft onTarifDotClick mit shift auf bei Sand-Dot-Click', async () => {
    const user = userEvent.setup()
    const onTarifDotClick = vi.fn()
    const shift = makeShift({ id: 42 })
    const warnings: Record<number, TarifWarning[]> = { 42: [makeTarifWarning(42)] }
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
        onTarifDotClick={onTarifDotClick}
        tarifWarnings={warnings}
      />
    )
    await user.click(screen.getByText('§'))
    expect(onTarifDotClick).toHaveBeenCalledWith(shift)
  })

  it('Sand-Dot-Click löst nicht onCellClick aus (stopPropagation)', async () => {
    const user = userEvent.setup()
    const onCellClick = vi.fn()
    const onTarifDotClick = vi.fn()
    const shift = makeShift({ id: 42 })
    const warnings: Record<number, TarifWarning[]> = { 42: [makeTarifWarning(42)] }
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={onCellClick} onConflictDotClick={vi.fn()}
        onTarifDotClick={onTarifDotClick}
        tarifWarnings={warnings}
      />
    )
    await user.click(screen.getByText('§'))
    expect(onTarifDotClick).toHaveBeenCalledTimes(1)
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('Konflikt-Dot und Sand-Dot koexistieren unabhängig', () => {
    const shift = makeShift({
      id: 5,
      conflicts: [{
        shift_id: 5, conflict_type: 'not_available', message: 'Im Urlaub',
        doctor_id: 1, doctor_name: 'Müller, Anna',
        shift_date: '2026-05-01', shift_type_short_name: 'F',
      }],
    })
    const warnings: Record<number, TarifWarning[]> = { 5: [makeTarifWarning(5)] }
    render(
      <PlanGrid
        shifts={[shift]} doctors={[doctor]}
        validFrom="2026-05-01" validTo="2026-05-31"
        onCellClick={vi.fn()} onConflictDotClick={vi.fn()}
        tarifWarnings={warnings}
      />
    )
    expect(screen.getByText('!')).toBeInTheDocument()
    expect(screen.getByText('§')).toBeInTheDocument()
  })
})
