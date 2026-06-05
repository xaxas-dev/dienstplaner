import { render, screen } from '@testing-library/react'
import { PlanKpiBar } from '../PlanKpiBar'
import type { ShiftWithDetails } from '@/lib/types'

const noShifts: ShiftWithDetails[] = []

const twoShifts: ShiftWithDetails[] = [
  { id: 1, doctor_id: 1, shift_date: '2026-05-04', conflicts: [], shift_type: null, is_pinned: false, is_locked: false, note: null } as unknown as ShiftWithDetails,
  { id: 2, doctor_id: null, shift_date: '2026-05-05', conflicts: [], shift_type: null, is_pinned: false, is_locked: false, note: null } as unknown as ShiftWithDetails,
]

test('renders Abdeckung label', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('Abdeckung')).toBeInTheDocument()
})

test('shows 0% when no shifts', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('0%')).toBeInTheDocument()
})

test('shows 50% when half assigned', () => {
  render(<PlanKpiBar shifts={twoShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={1} conflictCount={0} />)
  expect(screen.getByText('50%')).toBeInTheDocument()
})

test('shows offen count', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={4} conflictCount={0} />)
  expect(screen.getByText('4')).toBeInTheDocument()
  expect(screen.getByText('offen')).toBeInTheDocument()
})

test('shows Plan tab as active', () => {
  render(<PlanKpiBar shifts={noShifts} planFrom="2026-05-04" planTo="2026-05-31" openCount={0} conflictCount={0} />)
  expect(screen.getByText('Plan')).toBeInTheDocument()
})
