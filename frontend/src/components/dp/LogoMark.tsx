/**
 * Dienstplaner — Logo Mark
 *
 * "Sortier-D · Schicht" mark:
 *   Ein großes Initial-D — Rücken ist eine durchgehende Säule, der
 *   Bogen besteht aus fünf sortierten Schicht-Balken. Jeder Balken ist
 *   in 2–3 Schicht-Segmente (Früh/Spät/Nacht) unterteilt; eines ist
 *   gesetzt (solid), die anderen sind Kandidaten (opacity 0.32).
 *
 * Visual message in one glyph: "Ordnung ins Unübersichtliche — sortierte
 * Schichten". Pairs with Newsreader serif. Cream on terracotta by default.
 *
 * Drop at: frontend/src/components/dp/LogoMark.tsx
 *
 * Bonus: while the plan generator is running, pass `pulse` — die
 * fünf gesetzten Segmente pulsieren sequenziell top → bottom und das
 * Logo wird zum Live-Status-Indikator. CSS at the bottom of this file.
 */
const PAPER = '#FFF8EF'
const ACCENT = '#C66A3D'
const INK = '#26221C'

/** Raw SVG mark — geometry only, no container tile. */
export function LogoMarkSvg({ size = 38, fg = PAPER }: { size?: number; fg?: string }) {
  // Fünf sortierte Reihen, Rücken als durchgehende Säule.
  // Reihen: { Breite, Index des gesetzten Segments (0..segs-1) }
  const rows = [
    { w: 10, set: 2 },
    { w: 16, set: 2 },
    { w: 18, set: 1 },
    { w: 16, set: 0 },
    { w: 10, set: 0 },
  ] as const
  const barH = 4
  const gapY = 5
  const xStart = 9.4
  const segGap = 0.7
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Rücken des D — durchgehende Säule */}
      <rect x={7} y={8} width={3.4} height={24} rx={1.6} fill={fg} />
      {/* Sortierte Reihen mit Schicht-Segmenten */}
      <g className="dp-logo-bars">
        {rows.map((r, i) => {
          const y = 8 + i * gapY
          const segs = r.w >= 16 ? 3 : 2
          const segW = (r.w - (segs - 1) * segGap) / segs
          return (
            <g key={i}>
              {Array.from({ length: segs }, (_, s) => (
                <rect
                  key={s}
                  x={xStart + s * (segW + segGap)}
                  y={y}
                  width={segW}
                  height={barH}
                  rx={1.1}
                  fill={fg}
                  opacity={s === r.set ? undefined : 0.32}
                  data-bar={s === r.set ? i + 1 : undefined}
                />
              ))}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/**
 * Branded tile — terracotta background, cream mark.
 * Default size matches the rail (38×38). Pass `pulse` to animate
 * during plan-generator activity.
 */
export function LogoMark({
  size = 38,
  bg = ACCENT,
  fg = PAPER,
  radius = 12,
  pulse = false,
  ariaLabel = 'Dienstplaner',
}: {
  size?: number
  bg?: string
  fg?: string
  radius?: number
  pulse?: boolean
  ariaLabel?: string
}) {
  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className="inline-grid place-items-center"
      data-pulse={pulse ? '' : undefined}
      style={{ width: size, height: size, background: bg, borderRadius: radius }}
    >
      <LogoMarkSvg size={size} fg={fg} />
    </span>
  )
}

export function LogoWordmark({
  tone = 'on-paper',
  size = 32,
  pulse = false,
}: {
  tone?: 'on-paper' | 'on-dark'
  size?: number
  pulse?: boolean
}) {
  const onDark = tone === 'on-dark'
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} radius={size * 0.32} pulse={pulse} />
      <span
        className="font-serif"
        style={{
          fontSize: size * 0.7,
          fontWeight: 400,
          letterSpacing: '-0.015em',
          color: onDark ? PAPER : INK,
        }}
      >
        Dienst
        <span style={{ fontStyle: 'italic', color: ACCENT }}>planer</span>
      </span>
    </span>
  )
}

/**
 * ─── Status-indicator animation ─────────────────────────────────────
 * Add this CSS once in src/index.css (or any global stylesheet).
 * Die fünf gesetzten Schicht-Segmente pulsieren sequenziell top → bottom
 * während der Plan-Generator läuft. Outside `data-pulse`, das SVG ist
 * statisch — keine CPU-Last, keine Motion-Probleme.
 *
 *   @keyframes dp-logo-bar-pulse {
 *     0%, 70%, 100% { opacity: 1; }
 *     35%           { opacity: 0.35; }
 *   }
 *   [data-pulse] .dp-logo-bars [data-bar] {
 *     animation: dp-logo-bar-pulse 1.6s ease-in-out infinite;
 *   }
 *   [data-pulse] .dp-logo-bars [data-bar="1"] { animation-delay: 0s;    }
 *   [data-pulse] .dp-logo-bars [data-bar="2"] { animation-delay: 0.12s; }
 *   [data-pulse] .dp-logo-bars [data-bar="3"] { animation-delay: 0.24s; }
 *   [data-pulse] .dp-logo-bars [data-bar="4"] { animation-delay: 0.36s; }
 *   [data-pulse] .dp-logo-bars [data-bar="5"] { animation-delay: 0.48s; }
 *
 *   @media (prefers-reduced-motion: reduce) {
 *     [data-pulse] .dp-logo-bars [data-bar] { animation: none; }
 *   }
 */
