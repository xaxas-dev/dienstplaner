import * as React from 'react'
import { cn } from '@/lib/utils'

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
