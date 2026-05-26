import { describe, expect, it } from 'vitest'
import { getDepartmentColor, getDepartmentColorMuted } from './bereichColors'

describe('getDepartmentColor', () => {
  it('eigene Farbe wenn gesetzt', () => {
    expect(getDepartmentColor({ color: '#FF0000', display_order: 0 })).toBe('#FF0000')
  })

  it('Fallback-Palette wenn color null', () => {
    const color = getDepartmentColor({ color: null, display_order: 0 })
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('Fallback-Palette wenn color undefined', () => {
    const color = getDepartmentColor({ color: undefined, display_order: 1 })
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('verschiedene display_order → verschiedene Farben (Palette rotiert)', () => {
    const colors = [0, 1, 2, 3, 4, 5, 6, 7].map((o) =>
      getDepartmentColor({ color: null, display_order: o }),
    )
    // 8 unique Einträge in Palette
    const unique = new Set(colors)
    expect(unique.size).toBe(8)
  })

  it('display_order >= palette.length → Modulo-Wrap', () => {
    const c0 = getDepartmentColor({ color: null, display_order: 0 })
    const c8 = getDepartmentColor({ color: null, display_order: 8 })
    expect(c0).toBe(c8)
  })
})

describe('getDepartmentColorMuted', () => {
  it('fügt hex-Alpha-Suffix an', () => {
    const color = getDepartmentColorMuted({ color: '#3B82F6', display_order: 0 })
    expect(color).toBe('#3B82F640')
  })
})
