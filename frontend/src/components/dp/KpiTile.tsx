import * as React from 'react'
import { cn } from '@/lib/utils'

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
