import { describe, it, expect } from 'vitest'
import { wishMatchesCell, getWishHint } from '../wishGridUtils'
import type { Wish } from '@/lib/types'

function w(overrides: Partial<Wish>): Wish {
  return {
    id: 1,
    doctor_id: 1,
    wish_date: null,
    day_of_week: null,
    wish_type: 'AVOID_DAY',
    shift_type_id: null,
    priority: 1,
    notes: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('wishMatchesCell', () => {
  it('matches exact date', () => {
    expect(wishMatchesCell(w({ wish_date: '2026-03-15' }), 1, '2026-03-15')).toBe(true)
  })

  it('rejects different date', () => {
    expect(wishMatchesCell(w({ wish_date: '2026-03-15' }), 1, '2026-03-16')).toBe(false)
  })

  it('matches weekday (Freitag = day_of_week 4, 2026-03-20 is Fri)', () => {
    // 2026-03-20 is Friday: JS getDay()=5 → Python weekday=(5+6)%7=4
    expect(wishMatchesCell(w({ day_of_week: 4 }), 1, '2026-03-20')).toBe(true)
  })

  it('rejects wrong weekday', () => {
    // 2026-03-19 is Thursday: Python weekday=3, not 4
    expect(wishMatchesCell(w({ day_of_week: 4 }), 1, '2026-03-19')).toBe(false)
  })

  it('matches general wish on any date', () => {
    expect(wishMatchesCell(w({}), 1, '2026-03-15')).toBe(true)
    expect(wishMatchesCell(w({}), 1, '2026-12-31')).toBe(true)
  })

  it('rejects different doctor', () => {
    expect(
      wishMatchesCell(w({ wish_date: '2026-03-15', doctor_id: 2 }), 1, '2026-03-15'),
    ).toBe(false)
  })
})

describe('getWishHint', () => {
  it('returns avoid for AVOID_DAY', () => {
    expect(
      getWishHint([w({ wish_date: '2026-03-15', wish_type: 'AVOID_DAY' })], 1, '2026-03-15'),
    ).toBe('avoid')
  })

  it('returns avoid for AVOID_SHIFT', () => {
    expect(
      getWishHint(
        [w({ wish_date: '2026-03-15', wish_type: 'AVOID_SHIFT', shift_type_id: 1 })],
        1,
        '2026-03-15',
      ),
    ).toBe('avoid')
  })

  it('returns require for REQUIRE_SHIFT', () => {
    expect(
      getWishHint(
        [w({ wish_date: '2026-03-15', wish_type: 'REQUIRE_SHIFT', shift_type_id: 1 })],
        1,
        '2026-03-15',
      ),
    ).toBe('require')
  })

  it('avoid dominates over require', () => {
    const wishes = [
      w({ wish_date: '2026-03-15', wish_type: 'AVOID_DAY' }),
      w({ id: 2, wish_date: '2026-03-15', wish_type: 'REQUIRE_SHIFT', shift_type_id: 1 }),
    ]
    expect(getWishHint(wishes, 1, '2026-03-15')).toBe('avoid')
  })

  it('returns null when no match', () => {
    expect(getWishHint([w({ wish_date: '2026-03-16' })], 1, '2026-03-15')).toBeNull()
  })
})
