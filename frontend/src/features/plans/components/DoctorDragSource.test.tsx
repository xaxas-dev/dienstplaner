import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { DoctorDragSource } from './DoctorDragSource'
import type { Doctor } from '@/lib/types'

const doctors = [
  { id: 1, name: 'Dr. Test', short_name: 'TE', active: true } as unknown as Doctor,
]

function renderSource(locked: boolean) {
  return render(
    <DndContext>
      <DoctorDragSource doctors={doctors} locked={locked} />
    </DndContext>,
  )
}

describe('DoctorDragSource — locked', () => {
  it('Tokens sind ziehbar wenn nicht gesperrt', () => {
    renderSource(false)
    expect(screen.getByRole('button', { name: /Dr\. Test/ }))
      .toHaveAttribute('aria-roledescription', 'ziehbarer Arzt')
  })

  it('Tokens sind nicht ziehbar wenn gesperrt', () => {
    renderSource(true)
    expect(screen.getByRole('button', { name: /Dr\. Test/ }))
      .not.toHaveAttribute('aria-roledescription')
  })
})
