/**
 * Dienstplaner — Shift Color Palette
 *
 * Pastel palette for shift codes. Token-based, not RGB-based, so we can
 * tweak the palette globally without touching every shift type.
 *
 * Drop this at: frontend/src/lib/design/shift-palette.ts
 */

export const SHIFT_PALETTE = {
  peach: { bg: '#FBE0CE', fg: '#7A3B14', dot: '#E08A5A' },
  sage:  { bg: '#D9E5C9', fg: '#3F5527', dot: '#7A9E55' },
  plum:  { bg: '#DDCFE3', fg: '#3D2A48', dot: '#7B5A92' },
  sky:   { bg: '#CFDFE8', fg: '#1F4358', dot: '#5489A7' },
  rose:  { bg: '#F2CFD3', fg: '#6B1E2A', dot: '#C45766' },
  sand:  { bg: '#EEDFC4', fg: '#5A4220', dot: '#B59052' },
  lemon: { bg: '#F2E8B5', fg: '#5A4B14', dot: '#B8A33D' },
  grey:  { bg: '#E0DED7', fg: '#55524A', dot: '#928D80' },
} as const

export type ShiftColorToken = keyof typeof SHIFT_PALETTE

/**
 * Frontend-only mapping from ShiftType.id → color token.
 * As long as the backend ShiftType doesn't carry a `colorToken` field,
 * this map is the source of truth. Keep it in sync with the actual
 * shift type IDs in the DB.
 *
 * When the backend learns about `colorToken`, delete this map and read
 * the field from the ShiftType directly.
 */
export const SHIFT_TYPE_COLOR_MAP: Record<number, ShiftColorToken> = {
  // example — replace with real IDs
  // 1: 'peach',   // F  Frühdienst
  // 2: 'sage',    // S  Spätdienst
  // 3: 'plum',    // N  Nachtdienst
  // 4: 'sky',     // BD Bereitschaft
  // 5: 'rose',    // RD Rufdienst
  // 6: 'sand',    // U  Urlaub
  // 7: 'lemon',   // FT Feiertag
  // 8: 'grey',    // FR Frei
}

/**
 * Stable fallback: hash a shift code to a palette token so brand-new
 * shift types still get a color until they're added to the map.
 */
const FALLBACK_ORDER: ShiftColorToken[] = [
  'peach', 'sage', 'plum', 'sky', 'rose', 'sand', 'lemon', 'grey',
]

export function colorForShiftType(args: {
  id?: number
  code?: string
}): typeof SHIFT_PALETTE[ShiftColorToken] {
  if (args.id != null && SHIFT_TYPE_COLOR_MAP[args.id]) {
    return SHIFT_PALETTE[SHIFT_TYPE_COLOR_MAP[args.id]]
  }
  const seed = args.code ?? String(args.id ?? '?')
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return SHIFT_PALETTE[FALLBACK_ORDER[h % FALLBACK_ORDER.length]]
}
