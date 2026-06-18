import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WishFormDialog } from '../WishFormDialog'

const createMutate = vi.fn()
const updateMutate = vi.fn()
const createDoctorIds: number[] = []
const updateDoctorIds: number[] = []

vi.mock('../useWishes', () => ({
  useCreateWish: (doctorId: number) => {
    createDoctorIds.push(doctorId)
    return { mutate: createMutate, isPending: false }
  },
  useUpdateWish: (doctorId: number) => {
    updateDoctorIds.push(doctorId)
    return { mutate: updateMutate, isPending: false }
  },
}))
vi.mock('@/features/shift-types/useShiftTypes', () => ({
  useShiftTypes: () => ({ data: [{ id: 1, name: 'Nachtdienst', short_name: 'N' }] }),
}))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const defaultProps = { open: true, onOpenChange: vi.fn(), doctorId: 1 }
const doctors = [
  { id: 1, first_name: 'Anna', last_name: 'Müller', name: 'Dr. Anna Müller', short_name: 'AMü', active: true,
    doctor_type: 'INTERNAL' as const, rank: null, weiterbildungsjahr: null,
    employment_periods: [], qualifications: [], created_at: '', updated_at: '' },
  { id: 2, first_name: 'Bernd', last_name: 'Keller', name: 'Dr. Bernd Keller', short_name: 'BK', active: true,
    doctor_type: 'INTERNAL' as const, rank: null, weiterbildungsjahr: null,
    employment_periods: [], qualifications: [], created_at: '', updated_at: '' },
]

beforeEach(() => {
  createMutate.mockClear()
  updateMutate.mockClear()
  createDoctorIds.length = 0
  updateDoctorIds.length = 0
})

describe('WishFormDialog', () => {
  it('shows date input by default (Konkretes Datum)', () => {
    render(<WishFormDialog {...defaultProps} />)
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument()
  })

  it('switches to weekday select when Wochentag radio selected', async () => {
    render(<WishFormDialog {...defaultProps} />)
    await userEvent.click(screen.getByLabelText(/wochentag/i))
    expect(screen.queryByLabelText(/^datum/i)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /wochentag/i })).toBeInTheDocument()
  })

  it('hides date and weekday when Allgemein selected', async () => {
    render(<WishFormDialog {...defaultProps} />)
    await userEvent.click(screen.getByLabelText(/allgemein/i))
    expect(screen.queryByLabelText(/^datum/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /wochentag/i })).not.toBeInTheDocument()
  })

  it('shows shift type select for AVOID_SHIFT', async () => {
    render(<WishFormDialog {...defaultProps} />)
    const selects = screen.getAllByRole('combobox')
    await userEvent.click(selects[0])
    const options = await screen.findAllByText('Dienst vermeiden')
    await userEvent.click(options[options.length - 1])
    expect(screen.getByLabelText(/schichttyp/i)).toBeInTheDocument()
  })

  it('hides shift type select for AVOID_DAY', () => {
    render(<WishFormDialog {...defaultProps} />)
    expect(screen.queryByLabelText(/schichttyp/i)).not.toBeInTheDocument()
  })

  it('prefills date and hides sub-type radios when prefilledDate provided', () => {
    render(<WishFormDialog {...defaultProps} prefilledDate="2026-03-15" />)
    const dateInput = screen.getByLabelText(/datum/i) as HTMLInputElement
    expect(dateInput.value).toBe('2026-03-15')
    expect(screen.queryByLabelText(/wochentag/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/allgemein/i)).not.toBeInTheDocument()
  })

  it('starts with fuzzy doctor search when no doctor is preselected', async () => {
    const user = userEvent.setup()
    render(<WishFormDialog {...defaultProps} doctorId={null} doctors={doctors} />)

    expect(screen.getByText('Arzt auswählen')).toBeInTheDocument()
    expect(screen.queryByLabelText(/datum/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/arzt suchen/i), 'bk')
    expect(screen.getByText('Dr. Bernd Keller')).toBeInTheDocument()
    expect(screen.queryByText('Dr. Anna Müller')).not.toBeInTheDocument()

    await user.click(screen.getByText('Dr. Bernd Keller'))
    expect(screen.getByText('Neuer Wunsch')).toBeInTheDocument()
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument()
    expect(createDoctorIds).toContain(2)
  })
})
