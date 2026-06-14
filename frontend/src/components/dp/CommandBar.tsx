import * as React from 'react'
import { Search, ChevronRight, ChevronLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Chip } from './Chip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCommandPalette } from '@/features/command-palette/useCommandPalette'
import { isMac, getModifierGlyph } from '@/lib/platform'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface FilterChip {
  label: string
  active: boolean
  onClick: () => void
}

interface CommandBarProps {
  title: string
  titleAccent?: string
  titleNode?: React.ReactNode
  breadcrumb?: BreadcrumbItem[]
  filters?: FilterChip[]
  primaryAction?: {
    label: string
    icon?: LucideIcon
    onClick: () => void
  }
  showSearch?: boolean
  extras?: React.ReactNode
  className?: string
}

export function CommandBar({
  title,
  titleAccent,
  titleNode,
  breadcrumb,
  filters,
  primaryAction,
  showSearch = true,
  extras,
  className,
}: CommandBarProps) {
  const { open } = useCommandPalette()
  function handleSearchClick() { open() }

  return (
    <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-10 py-4 bg-paper', className)}>
      {/* Links: Breadcrumb, Titel, Filter-Chips */}
      <div className="flex items-center gap-3 min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 shrink-0">
            {breadcrumb.map((item, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="size-3 text-ink-3" />}
                {item.href ? (
                  <Link
                    to={item.href}
                    className={cn(
                      'text-xs text-ink-3 hover:text-ink transition-colors',
                      i === 0 && 'flex items-center gap-0.5',
                    )}
                  >
                    {i === 0 && <ChevronLeft className="size-3.5" />}
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-xs text-ink-3">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <h1 className="font-serif text-2xl text-ink leading-none shrink-0">
          {titleNode ?? (
            <>
              {titleAccent && (
                <em className="not-italic text-dp-accent">{titleAccent}</em>
              )}
              {titleAccent && title && ' '}
              {title}
            </>
          )}
        </h1>

        {filters && filters.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            {filters.map((f) => (
              <Chip
                key={f.label}
                variant={f.active ? 'active' : 'default'}
                onClick={f.onClick}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* Mitte: Suchfeld — immer zentriert */}
      {showSearch ? (
        <button
          type="button"
          onClick={handleSearchClick}
          className="flex items-center gap-2 h-9 min-w-[220px] px-3 rounded-full border border-line bg-card text-ink-3 text-sm hover:border-line-2 hover:text-ink transition-colors"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="text-xs flex-1 text-left hidden sm:inline">Suchen oder Befehl …</span>
          <span className="font-mono text-[10px] bg-line rounded px-1 py-0.5 leading-none shrink-0">
            {isMac() ? `${getModifierGlyph()}K` : `${getModifierGlyph()}+K`}
          </span>
        </button>
      ) : (
        <div />
      )}

      {/* Rechts: Extras, Primärbutton */}
      <div className="flex items-center gap-2 justify-end">
        {extras}

        {primaryAction && (
          <Button
            variant="accent"
            size="sm"
            onClick={primaryAction.onClick}
            className="shrink-0"
          >
            {primaryAction.icon && <primaryAction.icon className="size-4" />}
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}
