/** Returns hex color + '80' (50% alpha) for use as background, or neutral fallback. */
export function shiftTypeColorMuted(hex: string | null | undefined): string {
  if (!hex) return '#f4f4f5'
  return hex + '80'
}
