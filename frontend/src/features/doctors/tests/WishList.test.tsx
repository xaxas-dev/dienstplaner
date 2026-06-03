import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WishList } from '../WishList'

const mockWish = {
  id: 1, doctor_id: 1, wish_date: '2026-03-15', day_of_week: null,
  wish_type: 'AVOID_DAY' as const, shift_type_id: null,
  priority: 1, notes: null, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
}

vi.mock('../useWishes', () => ({
  useWishesByDoctor: () => ({ data: [mockWish], isLoading: false }),
  useDeleteWish: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../WishFormDialog', () => ({ WishFormDialog: () => null }))
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

describe('WishList', () => {
  it('renders wish with date and type label', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByText(/15\.03\.2026/i)).toBeInTheDocument()
    expect(screen.getByText(/Tag vermeiden/i)).toBeInTheDocument()
  })

  it('has Neuer-Wunsch button', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByRole('button', { name: /neuer wunsch/i })).toBeInTheDocument()
  })

  it('has Löschen button', () => {
    render(<WishList doctorId={1} />)
    expect(screen.getByRole('button', { name: /löschen/i })).toBeInTheDocument()
  })
})
