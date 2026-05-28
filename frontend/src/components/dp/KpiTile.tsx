import * as React from 'react'
import { cn } from '@/lib/utils'

export function KpiTile({
  value,
  label,
  sub,
  tone = 'default',
  onClick,
}: {
  value: React.ReactNode
  label: string
  sub?: string
  tone?: 'default' | 'warn' | 'ok'
  onClick?: () => void
}) {
  const toneCls = {
    default: 'bg-card border-line text-ink',
    warn:    'bg-warn-bg border-warn-line text-warn-ink',
    ok:      'bg-[#EEF1E2] border-[#D5DEB4] text-ok',
  }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={cn(
        'rounded-tile border p-4 text-left',
        toneCls,
        onClick && 'cursor-pointer hover:opacity-75 transition-opacity',
      )}
      onClick={onClick}
    >
      <div className="font-serif text-[32px] leading-none dp-num">{value}</div>
      <div className="mt-1.5 text-[13px] font-medium">{label}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </Tag>
  )
}
