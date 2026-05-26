function detectMac(): boolean {
  // Modernes API (Chromium)
  const platform = (navigator as Navigator & { userAgentData?: { platform: string } })
    .userAgentData?.platform ?? navigator.platform
  return /mac/i.test(platform)
}

export function isMac(): boolean { return detectMac() }
export function getModifierKey(): 'meta' | 'ctrl' { return isMac() ? 'meta' : 'ctrl' }
export function getModifierGlyph(): '⌘' | 'Strg' { return isMac() ? '⌘' : 'Strg' }
