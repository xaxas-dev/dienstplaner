import { describe, it, expect, afterEach } from 'vitest'

// isMac reads navigator.platform on each call — mock via prototype descriptor
const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform')

function mockPlatform(value: string) {
  Object.defineProperty(Navigator.prototype, 'platform', {
    get: () => value,
    configurable: true,
  })
}

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(Navigator.prototype, 'platform', originalDescriptor)
  }
})

describe('isMac', () => {
  it('returns true for MacIntel', async () => {
    mockPlatform('MacIntel')
    const { isMac } = await import('@/lib/platform')
    expect(isMac()).toBe(true)
  })

  it('returns false for Win32', async () => {
    mockPlatform('Win32')
    const { isMac } = await import('@/lib/platform')
    expect(isMac()).toBe(false)
  })

  it('returns false for Linux x86_64', async () => {
    mockPlatform('Linux x86_64')
    const { isMac } = await import('@/lib/platform')
    expect(isMac()).toBe(false)
  })
})

describe('getModifierGlyph', () => {
  it('returns ⌘ on Mac', async () => {
    mockPlatform('MacIntel')
    const { getModifierGlyph } = await import('@/lib/platform')
    expect(getModifierGlyph()).toBe('⌘')
  })

  it('returns Strg on Windows', async () => {
    mockPlatform('Win32')
    const { getModifierGlyph } = await import('@/lib/platform')
    expect(getModifierGlyph()).toBe('Strg')
  })
})

describe('getModifierKey', () => {
  it('returns meta on Mac', async () => {
    mockPlatform('MacIntel')
    const { getModifierKey } = await import('@/lib/platform')
    expect(getModifierKey()).toBe('meta')
  })

  it('returns ctrl on Windows', async () => {
    mockPlatform('Win32')
    const { getModifierKey } = await import('@/lib/platform')
    expect(getModifierKey()).toBe('ctrl')
  })
})
