import { describe, it, expect, beforeEach } from 'vitest'
import { getRecents, pushRecent, clearRecents } from '../recents'

describe('recents', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('getRecents returns [] when empty', () => {
    expect(getRecents()).toEqual([])
  })

  it('pushRecent adds item', () => {
    pushRecent({ id: 'nav-heute', label: 'Heute', group: 'navigation' })
    expect(getRecents()).toHaveLength(1)
    expect(getRecents()[0].id).toBe('nav-heute')
  })

  it('pushRecent deduplicates by id — latest wins position', () => {
    pushRecent({ id: 'nav-heute', label: 'Heute', group: 'navigation' })
    pushRecent({ id: 'nav-plans', label: 'Pläne', group: 'navigation' })
    pushRecent({ id: 'nav-heute', label: 'Heute', group: 'navigation' })
    const recents = getRecents()
    expect(recents).toHaveLength(2)
    expect(recents[0].id).toBe('nav-heute')
  })

  it('pushRecent caps at 5 entries', () => {
    for (let i = 0; i < 7; i++) {
      pushRecent({ id: `item-${i}`, label: `Item ${i}`, group: 'navigation' })
    }
    expect(getRecents()).toHaveLength(5)
  })

  it('clearRecents empties the list', () => {
    pushRecent({ id: 'nav-heute', label: 'Heute', group: 'navigation' })
    clearRecents()
    expect(getRecents()).toEqual([])
  })

  it('getRecents handles corrupted JSON gracefully', () => {
    localStorage.setItem('dp-command-palette-recents', 'not-json')
    expect(getRecents()).toEqual([])
  })

  it('getRecents rejects non-array JSON', () => {
    localStorage.setItem('dp-command-palette-recents', '{"id":"x"}')
    expect(getRecents()).toEqual([])
  })

  it('getRecents filters out malformed entries', () => {
    localStorage.setItem(
      'dp-command-palette-recents',
      JSON.stringify([{ id: 'ok', label: 'OK', group: 'navigation' }, { bad: true }])
    )
    const result = getRecents()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ok')
  })
})
