import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { UnifiedShiftCell } from '../components/UnifiedShiftCell'
import type { Department } from '@/lib/types'

const mockDept: Department = {
  id: 1,
  name: 'INA',
  display_order: 1,
  color: null,
  is_ina: true,
  full_time_slots: 1,
}

vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

const baseProps = {
  rotationId: 1,
  dayKey: '2026-06-07',
  department: mockDept,
  inRotation: true,
  text: 'AMü',
  isWeekend: false,
  isToday: false,
  focusMode: 'alle' as const,
  shiftId: 42,
  shiftAssigned: true,
}

function wrap(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>)
}

describe('UnifiedShiftCell locked', () => {
  it('rendert Schloss-Icon wenn isLocked=true', () => {
    wrap(<UnifiedShiftCell {...baseProps} isLocked={true} />)
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument()
  })

  it('ruft onClick nicht auf wenn isLocked=true', () => {
    const onClick = vi.fn()
    const { container } = wrap(
      <UnifiedShiftCell {...baseProps} isLocked={true} onClick={onClick} />
    )
    fireEvent.click(container.firstChild as Element)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('rendert kein Schloss-Icon wenn isLocked=false', () => {
    wrap(<UnifiedShiftCell {...baseProps} isLocked={false} />)
    expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument()
  })
})
