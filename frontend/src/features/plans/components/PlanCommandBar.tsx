import { ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isMac, getModifierGlyph } from '@/lib/platform'
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
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-10 py-4 bg-paper shrink-0">
      {/* Links: Titel, Prev/Next, Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-serif text-2xl tracking-tight leading-none shrink-0">
          <span className="italic text-dp-accent">{planMonth}</span>
          {' '}
          <span className="text-ink">{planYear}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
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

        <span className="text-[13px] text-ink-3 truncate">
          KW {kwRange}{planName ? ` · ${planName}` : ''}
        </span>
      </div>

      {/* Mitte: Suchfeld — immer zentriert */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2 h-9 min-w-[220px] px-3 rounded-full border border-line bg-card text-ink-3 text-sm hover:border-line-2 hover:text-ink transition-colors"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="text-xs flex-1 text-left hidden sm:inline">Suchen oder Befehl …</span>
        <span className="font-mono text-[10px] bg-line rounded px-1 py-0.5 leading-none shrink-0">
          {isMac() ? `${getModifierGlyph()}K` : `${getModifierGlyph()}+K`}
        </span>
      </button>

      {/* Rechts: Status-Dropdown, Export */}
      <div className="flex items-center gap-2 justify-end">
        {plan && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={isUpdatingStatus}
                className="flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-line-2 bg-card text-[12.5px] text-ink-2 hover:bg-paper transition-colors disabled:opacity-60"
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

        <button
          type="button"
          onClick={onExport}
          aria-label="Exportieren"
          className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors"
        >
          Exportieren
        </button>
      </div>
    </div>
  )
}
