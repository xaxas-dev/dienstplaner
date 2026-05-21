import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { RotationGrid } from '../components/RotationGrid'
import type { RotationAssignmentWithDetails, Department, INAAvailability } from '@/lib/types'

const dept: Department = {
  id: 1,
  name: 'Neurologie',
  short_name: 'NEU',
  is_external: false,
  is_shift_relevant: true,
  active: true,
  display_order: 0,
  requires_full_time: false,
  min_headcount: null,
  max_headcount: null,
  blocks_ina_weekdays: false,
  blocks_ina_weekends: false,
  notes: null,
  created_at: '',
  updated_at: '',
}

const rotations: RotationAssignmentWithDetails[] = []

// 2026-06-01 is a Monday — use a 2-day range for a minimal grid
const VALID_FROM = '2026-06-01'
const VALID_TO = '2026-06-02'

const DATE_UNAVAILABLE = '2026-06-01'
const DATE_AVAILABLE = '2026-06-02'

const availability: Record<string, INAAvailability> = {
  [DATE_UNAVAILABLE]: {
    date: DATE_UNAVAILABLE,
    available: false,
    reasons: ['Rotation INA-Sperre', 'Abwesenheit'],
  },
  [DATE_AVAILABLE]: {
    date: DATE_AVAILABLE,
    available: true,
    reasons: [],
  },
}

function renderGrid(availProp?: Record<string, INAAvailability>) {
  return render(
    <DndContext>
      <RotationGrid
        rotations={rotations}
        departments={[dept]}
        validFrom={VALID_FROM}
        validTo={VALID_TO}
        onCellClick={vi.fn()}
        availability={availProp}
      />
    </DndContext>,
  )
}

// Helper: the outer drop-cell wrapper divs have h-[42px] class
function getDropCellDivs(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.h-\\[42px\\]'))
}

describe('RotationGrid – Verfügbarkeits-Hint', () => {
  it('nicht-verfügbare Zelle hat ring-amber Hint-Klasse', () => {
    renderGrid(availability)

    const unavailDiv = document.querySelector<HTMLElement>('[title]')
    expect(unavailDiv).not.toBeNull()
    expect(unavailDiv!.className).toContain('ring-amber-400/60')
  })

  it('verfügbare Zelle hat KEINE ring-amber Hint-Klasse', () => {
    renderGrid(availability)

    // 2 drop cells: one has title (unavailable), one has none (available)
    const cells = getDropCellDivs()
    const availCell = cells.find((el) => !el.title)
    expect(availCell).toBeDefined()
    expect(availCell!.className).not.toContain('ring-amber-400/60')
  })

  it('tooltip (title) zeigt Gründe auf nicht-verfügbarer Zelle', () => {
    renderGrid(availability)

    const unavailDiv = document.querySelector<HTMLElement>('[title]')
    expect(unavailDiv).not.toBeNull()
    expect(unavailDiv!.title).toBe('Rotation INA-Sperre, Abwesenheit')
  })

  it('kein Hint wenn availability undefined (kein title-Attribut)', () => {
    renderGrid(undefined)

    const cellsWithTitle = document.querySelectorAll('[title]')
    expect(cellsWithTitle.length).toBe(0)
  })
})
