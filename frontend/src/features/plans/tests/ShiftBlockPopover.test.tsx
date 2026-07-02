import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ShiftBlockPopover } from '../components/ShiftBlockPopover'
import type { Department } from '@/lib/types'

const mockDepts: Department[] = [
  {
    id: 1,
    name: 'Station A',
    short_name: 'STA',
    active: true,
    display_order: 1,
    color: null,
    blocks_ina_weekdays: false,
    blocks_ina_weekends: false,
    is_external: false,
    is_shift_relevant: true,
    requires_full_time: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Station B',
    short_name: 'STB',
    active: true,
    display_order: 2,
    color: null,
    blocks_ina_weekdays: false,
    blocks_ina_weekends: false,
    is_external: false,
    is_shift_relevant: true,
    requires_full_time: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Inaktiv',
    short_name: 'INA',
    active: false,
    display_order: 3,
    color: null,
    blocks_ina_weekdays: false,
    blocks_ina_weekends: false,
    is_external: false,
    is_shift_relevant: false,
    requires_full_time: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

describe('ShiftBlockPopover — Springer', () => {
  it('zeigt nur aktive Abteilungen als Springer-Chips', () => {
    render(
      <ShiftBlockPopover
        selectedCount={2}
        shiftTypes={[]}
        onSelectShiftType={vi.fn()}
        onRemoveAll={vi.fn()}
        onClose={vi.fn()}
        departments={mockDepts}
        onAssignSpringer={vi.fn()}
      />
    )
    expect(screen.getByText('STA')).toBeInTheDocument()
    expect(screen.getByText('STB')).toBeInTheDocument()
    expect(screen.queryByText('INA')).not.toBeInTheDocument()
  })

  it('ruft onAssignSpringer mit korrekter departmentId auf', () => {
    const onAssignSpringer = vi.fn()
    render(
      <ShiftBlockPopover
        selectedCount={2}
        shiftTypes={[]}
        onSelectShiftType={vi.fn()}
        onRemoveAll={vi.fn()}
        onClose={vi.fn()}
        departments={mockDepts}
        onAssignSpringer={onAssignSpringer}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
    expect(onAssignSpringer).toHaveBeenCalledWith(2)
  })
})
