import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { BereichHeaderRow } from './BereichHeaderRow'
import type { Department } from '@/lib/types'

const mockDept: Department = {
  id: 1,
  name: 'Neurologie',
  short_name: 'Neuro',
  display_order: 1,
  blocks_ina_weekdays: false,
  blocks_ina_weekends: false,
  max_headcount: null,
  min_headcount: null,
  color: null,
  active: true,
  is_external: false,
  is_shift_relevant: true,
  requires_full_time: false,
  notes: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>
}

describe('BereichHeaderRow', () => {
  it('renders + button when onAddRotation provided', () => {
    render(
      <BereichHeaderRow department={mockDept} onAddRotation={vi.fn()} />,
      { wrapper: Wrapper },
    )
    expect(screen.getByRole('button', { name: 'Arzt hinzufügen' })).toBeTruthy()
  })

  it('calls onAddRotation when + button is clicked', async () => {
    const onAdd = vi.fn()
    render(
      <BereichHeaderRow department={mockDept} onAddRotation={onAdd} />,
      { wrapper: Wrapper },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Arzt hinzufügen' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('does not render + button without onAddRotation', () => {
    render(<BereichHeaderRow department={mockDept} />, { wrapper: Wrapper })
    expect(screen.queryByRole('button', { name: 'Arzt hinzufügen' })).toBeNull()
  })
})
