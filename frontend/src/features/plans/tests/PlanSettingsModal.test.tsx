import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanSettingsModal } from '../components/PlanSettingsModal'

const mutate = vi.fn()

vi.mock('../useConstraintOverrides', () => ({
  useConstraintOverrides: () => ({ data: [] }),
  useCreateConstraintOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteConstraintOverride: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../usePlans', () => ({
  usePlan: () => ({ data: { id: 1, besetzung_locked: false } }),
}))

vi.mock('../useUpdatePlan', () => ({
  useUpdatePlan: () => ({ mutate, isPending: false }),
}))

describe('PlanSettingsModal — Besetzungssperre', () => {
  beforeEach(() => mutate.mockClear())

  it('toggelt besetzung_locked beim Klick', () => {
    render(<PlanSettingsModal planId={1} open onOpenChange={() => {}} />)
    const toggle = screen.getByLabelText('Besetzung sperren')
    fireEvent.click(toggle)
    expect(mutate).toHaveBeenCalledWith({ besetzung_locked: true })
  })
})
