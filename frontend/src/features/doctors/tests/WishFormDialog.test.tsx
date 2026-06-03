import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WishFormDialog } from '../WishFormDialog'

vi.mock('../useWishes', () => ({
  useCreateWish: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateWish: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/features/shift-types/useShiftTypes', () => ({
  useShiftTypes: () => ({ data: [{ id: 1, name: 'Nachtdienst', short_name: 'N' }] }),
}))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const defaultProps = { open: true, onOpenChange: vi.fn(), doctorId: 1 }

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
})
