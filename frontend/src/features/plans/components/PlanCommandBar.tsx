import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface PlanCommandBarProps {
  planMonth: string
  planYear: string
  kwRange: string
  planName?: string
  prevPlan: { id: number; valid_from: string } | null
  nextPlan: { id: number; valid_from: string } | null
  plan: { status: 'DRAFT' | 'RELEASED' | 'ARCHIVED' } | undefined
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onStatusChange: (s: 'DRAFT' | 'RELEASED' | 'ARCHIVED') => void
  isUpdatingStatus: boolean
  onExport: () => void
  onOpenCommandPalette: () => void
}

export function PlanCommandBar({
  planMonth,
  planYear,
  kwRange,
  planName,
  prevPlan,
  nextPlan,
  plan,
  onNavigatePrev,
  onNavigateNext,
  onStatusChange,
  isUpdatingStatus,
  onExport,
  onOpenCommandPalette,
}: PlanCommandBarProps) {
  const statusLabel =
    plan?.status === 'RELEASED' ? 'Freigegeben'
    : plan?.status === 'ARCHIVED' ? 'Archiviert'
    : 'Entwurf'

  const statusDotClass =
    plan?.status === 'RELEASED' ? 'bg-green-500'
    : plan?.status === 'ARCHIVED' ? 'bg-amber-400'
    : 'bg-gray-400'

  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-line bg-paper flex-wrap shrink-0">
      {/* Titel */}
      <span className="font-serif text-2xl tracking-tight leading-none">
        <span className="italic text-dp-accent">{planMonth}</span>
        {' '}
        <span className="text-ink">{planYear}</span>
      </span>

      {/* Prev / Next */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNavigatePrev}
          disabled={!prevPlan}
          aria-label="Vorheriger Plan"
          className="w-7 h-7 rounded-[8px] bg-card border border-line text-ink-2 flex items-center justify-center hover:bg-paper disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onNavigateNext}
          disabled={!nextPlan}
          aria-label="Nächster Plan"
          className="w-7 h-7 rounded-[8px] bg-card border border-line text-ink-2 flex items-center justify-center hover:bg-paper disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      {/* Subtitle */}
      <span className="text-[13px] text-ink-3">
        KW {kwRange}{planName ? ` · ${planName}` : ''}
      </span>

      <div className="flex-1" />

      {/* Status-Badge mit Dropdown */}
      {plan && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={isUpdatingStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-line-2 bg-card text-[12.5px] text-ink-2 hover:bg-paper transition-colors disabled:opacity-60"
            >
              <span className={cn('size-1.5 rounded-full', statusDotClass)} />
              {statusLabel}
              <ChevronDown className="size-3 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {plan.status !== 'RELEASED' && (
              <DropdownMenuItem onClick={() => onStatusChange('RELEASED')}>Freigeben</DropdownMenuItem>
            )}
            {plan.status !== 'ARCHIVED' && (
              <DropdownMenuItem onClick={() => onStatusChange('ARCHIVED')}>Archivieren</DropdownMenuItem>
            )}
            {plan.status !== 'DRAFT' && (
              <DropdownMenuItem onClick={() => onStatusChange('DRAFT')}>Zurück zu Entwurf</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Suche */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2 min-w-[200px] px-3 py-1.5 border border-line-2 rounded-full bg-card text-[13px] text-ink-3 hover:bg-paper transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Suchen oder Befehl …</span>
        <span className="font-mono text-[11px]">⌘K</span>
      </button>

      {/* Export */}
      <button
        type="button"
        onClick={onExport}
        aria-label="Exportieren"
        className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors"
      >
        Exportieren
      </button>
    </div>
  )
}
