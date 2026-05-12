/**
 * Dienstplaner — UI Primitives (stubs)
 *
 * Copy-paste-ready starting points for the components called out in
 * Implementierungsanleitung.md §6. Drop these into
 *   frontend/src/components/dp/
 * as individual files (one component per file) — they're collected
 * here only so the handoff is a single review surface.
 *
 * Assumes Tailwind has been extended per handoff/tailwind.merge.ts.
 */
import * as React from 'react'
import { cn } from '@/lib/utils' // shadcn helper, already present
import { COLORS, hueFromId } from '@/lib/design/tokens'
import { colorForShiftType, type ShiftColorToken } from '@/lib/design/shift-palette'

/* ─────────────────────────────────────────────────────────────────────────
   Chip — generic filter / status pill
   ───────────────────────────────────────────────────────────────────────── */
type ChipProps = {
  variant?: 'default' | 'active' | 'accent' | 'muted' | 'ok'
  dot?: boolean
  className?: string
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export function Chip({ variant = 'default', dot, className, children, ...rest }: ChipProps) {
  const styles = {
    default: 'bg-card border-line text-ink',
    active:  'bg-ink text-paper border-ink',
    accent:  'bg-warn-bg text-warn-ink border-warn-line',
    muted:   'bg-paper text-ink-3 border-line',
    ok:      'bg-[#E5EAD5] text-ok border-[#C8D6A8]',
  }[variant]
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium leading-none transition',
        'hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ink',
        styles,
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   ShiftChip — pill rendering a shift code in its pastel palette
   ───────────────────────────────────────────────────────────────────────── */
export function ShiftChip({
  code,
  shiftTypeId,
  size = 'md',
  className,
}: {
  code: string
  shiftTypeId?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const c = colorForShiftType({ id: shiftTypeId, code })
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full font-semibold leading-none', sizeCls, className)}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {code}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   ShiftCell — square cell for the Plan grid
   ───────────────────────────────────────────────────────────────────────── */
export function ShiftCell({
  code,
  shiftTypeId,
  conflict,
  weekend,
  today,
  onClick,
}: {
  code?: string
  shiftTypeId?: number
  conflict?: boolean
  weekend?: boolean
  today?: boolean
  onClick?: () => void
}) {
  if (!code) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'aspect-square w-full rounded-cell border border-dashed border-line/60 transition',
          'hover:border-ink-3/40 hover:bg-card',
          weekend && 'bg-weekend/40',
          today && 'ring-2 ring-warn-line',
        )}
      />
    )
  }
  const c = colorForShiftType({ id: shiftTypeId, code })
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-square w-full rounded-cell text-[11px] font-bold leading-none transition',
        'hover:brightness-95',
        conflict && 'ring-1.5 ring-warn',
        today && 'ring-2 ring-warn-line',
      )}
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {code}
      {conflict && (
        <span className="absolute -right-1 -top-1 grid size-3 place-items-center rounded-full bg-warn text-[8px] font-bold text-paper">
          !
        </span>
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Avatar — initials, deterministic pastel hue from id
   ───────────────────────────────────────────────────────────────────────── */
export function Avatar({
  name,
  id,
  size = 32,
}: {
  name: string
  id: number | string
  size?: number
}) {
  const hue = hueFromId(id)
  const initials = name
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span
      className="inline-grid place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: `oklch(0.86 0.08 ${hue})`,
        color: `oklch(0.32 0.12 ${hue})`,
      }}
    >
      {initials}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   KpiTile — big serif number, small label
   ───────────────────────────────────────────────────────────────────────── */
export function KpiTile({
  value,
  label,
  sub,
  tone = 'default',
}: {
  value: React.ReactNode
  label: string
  sub?: string
  tone?: 'default' | 'warn' | 'ok'
}) {
  const toneCls = {
    default: 'bg-card border-line text-ink',
    warn:    'bg-warn-bg border-warn-line text-warn-ink',
    ok:      'bg-[#EEF1E2] border-[#D5DEB4] text-ok',
  }[tone]
  return (
    <div className={cn('rounded-tile border p-4', toneCls)}>
      <div className="font-serif text-[32px] leading-none dp-num">{value}</div>
      <div className="mt-1.5 text-[13px] font-medium">{label}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   Sparkline — vertical bars, e.g. 14-day coverage
   ───────────────────────────────────────────────────────────────────────── */
export function Sparkline({
  values,
  threshold = 0.8,
  height = 28,
}: {
  values: number[]   // each 0..1
  threshold?: number
  height?: number
}) {
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${Math.max(v, 0.05) * 100}%`,
            backgroundColor: v < threshold ? COLORS.warn : COLORS.accent2,
            opacity: v < threshold ? 0.9 : 0.7,
          }}
        />
      ))}
    </div>
  )
}
