import * as React from 'react'
import { Search, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  breadcrumb?: BreadcrumbItem[]
  filters?: FilterChip[]
  primaryAction?: {
    label: string
    icon?: LucideIcon
    onClick: () => void
  }
  showSearch?: boolean
  className?: string
}

export function CommandBar({
  title,
  titleAccent,
  breadcrumb,
  filters,
  primaryAction,
  showSearch = true,
  className,
}: CommandBarProps) {
  const { open } = useCommandPalette()
  function handleSearchClick() { open() }

  return (
    <div className={cn('flex items-center gap-3 px-10 py-4 bg-paper', className)}>
      {/* Titel */}
      <h1 className="font-serif text-2xl text-ink leading-none shrink-0">
        {titleAccent && (
          <em className="not-italic text-dp-accent">{titleAccent}</em>
        )}
        {titleAccent && title && ' '}
        {title}
      </h1>

      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-ink-3 shrink-0">
          {breadcrumb.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="size-3" />}
              {item.href ? (
                <a href={item.href} className="hover:text-ink transition-colors">
                  {item.label}
                </a>
              ) : (
                <span>{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Filter-Chips */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Suchfeld */}
      {showSearch && (
        <button
          type="button"
          onClick={handleSearchClick}
          className="flex items-center gap-2 h-8 px-3 rounded-full border border-line bg-card text-ink-3 text-sm hover:border-line-2 hover:text-ink transition-colors"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="text-xs hidden sm:inline">Suchen</span>
          <span className="font-mono text-[10px] bg-line rounded px-1 py-0.5 leading-none">
            {isMac() ? `${getModifierGlyph()}K` : `${getModifierGlyph()}+K`}
          </span>
        </button>
      )}

      {/* Primärbutton */}
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
  )
}
