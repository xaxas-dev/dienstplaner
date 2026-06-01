import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShiftHeatmap14 } from '../ShiftHeatmap14'
import type { ShiftType } from '@/lib/types'

const mockShiftType: ShiftType = {
  id: 1,
  name: 'Tagdienst',
  short_name: 'T',
  applies_on_weekdays: true,
  applies_on_weekend: false,
  start_time: '07:00',
  end_time: '15:30',
  display_order: 1,
  active: true,
  notes: null,
  is_bereitschaftsdienst: false,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

describe('ShiftHeatmap14', () => {
  it('rendert 14 leere Boxen bei leerem shifts-Array', () => {
    const { container } = render(<ShiftHeatmap14 shifts={[]} />)
    const boxes = container.querySelectorAll('span')
    expect(boxes).toHaveLength(14)
  })

  it('leere Boxen haben gestrichelten Rand-Stil', () => {
    const { container } = render(<ShiftHeatmap14 shifts={[]} />)
    const firstBox = container.querySelector('span')
    expect(firstBox?.className).toContain('border-dashed')
  })

  it('rendert Boxen mit Schichttyp-Hintergrundfarbe', () => {
    const shifts = [{ date: '2026-05-13', shiftType: mockShiftType }]
    const { container } = render(<ShiftHeatmap14 shifts={shifts} />)
    const boxes = container.querySelectorAll('span')
    expect(boxes).toHaveLength(14)
    // erste Box hat inline bg-color (aus Shift-Palette)
    expect(boxes[0].getAttribute('style')).toContain('background-color')
  })

  it('füllt fehlende Einträge mit leeren Boxen auf', () => {
    const shifts = [
      { date: '2026-05-13', shiftType: mockShiftType },
      { date: '2026-05-14' },
    ]
    const { container } = render(<ShiftHeatmap14 shifts={shifts} />)
    const boxes = container.querySelectorAll('span')
    expect(boxes).toHaveLength(14)
    // zweite Box: kein shiftType → gestrichelt
    expect(boxes[1].className).toContain('border-dashed')
  })

  it('title-Attribut zeigt short_name des Schichttyps', () => {
    const shifts = [{ date: '2026-05-13', shiftType: mockShiftType }]
    render(<ShiftHeatmap14 shifts={shifts} />)
    expect(screen.getByTitle('T')).toBeInTheDocument()
  })
})
