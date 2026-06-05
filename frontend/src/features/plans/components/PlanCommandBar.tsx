import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PlanCommandBarProps {
  planMonth: string
  planYear: string
  kwRange: string
  rotationCount: number
  conflictCount: number
  prevPlan: { id: number; valid_from: string } | null
  nextPlan: { id: number; valid_from: string } | null
  solverEnabled: boolean
  isSolving: boolean
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onSolve: () => void
  onExport: () => void
  onScrollToConflict: () => void
  onOpenCommandPalette: () => void
}

export function PlanCommandBar({
  planMonth,
  planYear,
  kwRange,
  rotationCount,
  conflictCount,
  prevPlan,
  nextPlan,
  solverEnabled,
  isSolving,
  onNavigatePrev,
  onNavigateNext,
  onSolve,
  onExport,
  onScrollToConflict,
  onOpenCommandPalette,
}: PlanCommandBarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3.5 border-b border-line bg-paper flex-wrap shrink-0">
      {/* Titel */}
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-2xl tracking-tight leading-none">
          <span className="italic text-dp-accent">{planMonth}</span>
          {' '}
          <span className="text-ink">{planYear}</span>
        </span>
        <span className="text-[13px] text-ink-3">· KW {kwRange} · {rotationCount} Ärzte</span>
      </div>

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

      <div className="w-px h-[22px] bg-line mx-1 shrink-0" />

      {/* Filter-Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] font-medium bg-ink text-[#FBF6E8] border border-ink select-none">
          2 Wochen
        </span>
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] bg-card text-ink-2 border border-line-2 select-none">
          Alle Stationen
        </span>
        <span className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] bg-card text-ink-2 border border-line-2 select-none">
          Alle Schichten
        </span>
        {conflictCount > 0 && (
          <button
            type="button"
            onClick={onScrollToConflict}
            className="inline-flex items-center px-3 py-[5px] rounded-full text-[12px] font-medium bg-warn-bg text-warn-ink border border-warn-line hover:opacity-80 transition-opacity"
          >
            {conflictCount} Konflikte
          </button>
        )}
      </div>

      <div className="flex-1" />

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

      {/* Primäraktion */}
      {solverEnabled ? (
        <button
          type="button"
          onClick={onSolve}
          disabled={isSolving}
          aria-label="Plan generieren"
          className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover disabled:opacity-60 transition-colors"
        >
          {isSolving ? 'Berechne…' : 'Plan generieren'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onExport}
          aria-label="Exportieren"
          className="px-4 py-2 rounded-full bg-dp-accent text-[#FFF8EF] text-[13px] font-medium hover:bg-dp-accent-hover transition-colors"
        >
          Exportieren
        </button>
      )}
    </div>
  )
}
