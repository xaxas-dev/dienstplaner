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
  is_external: false,
  is_shift_relevant: true,
  active: true,
  requires_full_time: false,
  blocks_ina_weekdays: false,
  blocks_ina_weekends: false,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
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
  activeFilterGroups: new Set<string>(),
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

describe('UnifiedShiftCell – Dimming', () => {
  const basePropsNew = {
    rotationId: 1,
    dayKey: '2026-06-07',
    department: mockDept,
    inRotation: true,
    text: 'T',
    isWeekend: false,
    isToday: false,
    activeFilterGroups: new Set<string>(),
    shiftFilterGroup: null as string | null,
    shiftId: 42,
    shiftAssigned: true,
  }

  it('dimmt nicht wenn activeFilterGroups leer', () => {
    const { container } = wrap(
      <UnifiedShiftCell {...basePropsNew} activeFilterGroups={new Set()} shiftFilterGroup="Nacht" />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).not.toMatch(/opacity-30/)
  })

  it('dimmt nicht wenn shiftFilterGroup null', () => {
    const { container } = wrap(
      <UnifiedShiftCell {...basePropsNew} activeFilterGroups={new Set(['Nacht'])} shiftFilterGroup={null} />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).not.toMatch(/opacity-30/)
  })

  it('dimmt wenn shiftFilterGroup nicht in aktiver Gruppe', () => {
    const { container } = wrap(
      <UnifiedShiftCell {...basePropsNew} activeFilterGroups={new Set(['Nacht'])} shiftFilterGroup="Tag" />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).toMatch(/opacity-30/)
  })

  it('dimmt nicht wenn shiftFilterGroup in aktiver Gruppe', () => {
    const { container } = wrap(
      <UnifiedShiftCell {...basePropsNew} activeFilterGroups={new Set(['Nacht'])} shiftFilterGroup="Nacht" />
    )
    const cell = container.firstChild as HTMLElement
    expect(cell.className).not.toMatch(/opacity-30/)
  })
})
