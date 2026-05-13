/**
 * Dienstplaner — Design Tokens
 *
 * Single source of truth for colors, radii, spacing, fonts.
 * Used by Tailwind config AND directly by primitives where needed.
 *
 * Drop this at: frontend/src/lib/design/tokens.ts
 */

export const COLORS = {
  paper:    '#F6F1E6', // app background
  card:     '#FFFCF5', // surface (cards, table rows)
  ink:      '#26221C', // primary text
  ink2:     '#5C544A', // secondary text
  ink3:     '#8A8275', // tertiary / labels
  line:     '#E8E0CF', // hairline borders
  line2:    '#D6CCB6', // emphasized borders
  accent:      '#C66A3D', // terracotta — primary CTA, brand glyph
  accentHover: '#B45B30', // darker terracotta — hover state for accent buttons
  accent2:     '#E69E66', // lighter terracotta — sparklines, hover
  ok:       '#5A7A3A', // success
  warn:     '#B85B22', // warning / conflict
  warnBg:   '#FBE5D6', // warning surface
  warnLine: '#F0C3A2', // warning border
  warnInk:  '#7A3414', // warning text
  todayBg:  '#FAF0DC', // selected row / today highlight
  weekendBg:'#F3ECD8', // weekend column tint
} as const

export type ColorToken = keyof typeof COLORS

export const RADII = {
  card: 16,        // rounded-2xl
  tile: 14,        // KPI tiles
  chip: 999,       // rounded-full
  cell: 7,         // plan grid cells (rounded-md)
  rail: 12,        // rail icon-buttons (rounded-xl)
  control: 10,
} as const

export const SPACING = {
  pagePadX: 40,    // px-10
  pagePadY: 28,
  cardPad: 20,     // p-5
  gridGap: 14,     // gap-3.5
  railWidth: 60,   // mini-rail
  contextPanel: 290,
} as const

export const FONTS = {
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
  serif: '"Newsreader", ui-serif, Georgia, serif',
  mono: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
} as const

export const TYPE_SCALE = {
  // Headings (serif, Newsreader)
  h1: { font: FONTS.serif, size: 38, weight: 400, lineHeight: 1.1, letterSpacing: '-0.01em' },
  h2: { font: FONTS.serif, size: 28, weight: 400, lineHeight: 1.15 },
  h3: { font: FONTS.serif, size: 22, weight: 500, lineHeight: 1.2 },
  kpi:{ font: FONTS.serif, size: 32, weight: 400, lineHeight: 1, features: '"tnum"' },

  // UI (sans, Geist)
  body:  { font: FONTS.sans, size: 14, weight: 400, lineHeight: 1.5 },
  small: { font: FONTS.sans, size: 13, weight: 500, lineHeight: 1.4 },
  micro: { font: FONTS.sans, size: 11, weight: 500, lineHeight: 1.3 },
  kicker:{ font: FONTS.sans, size: 12, weight: 500, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.08em' },
} as const

/**
 * Deterministic avatar hue from a stable ID (doctor.id, etc).
 * Returns a hue [0..360) for use in `oklch(0.86 0.08 ${hue})`.
 */
export function hueFromId(id: number | string): number {
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 360
}
