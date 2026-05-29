import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import type { AttentionItem } from '@/lib/types'

const DOT_COLOR: Record<string, string> = {
  error: '#B85B22',
  warning: '#D97706',
  info: '#5A7A3A',
}

interface AttentionRowProps {
  item: AttentionItem
  href?: string
}

export function AttentionRow({ item, href }: AttentionRowProps) {
  const dotColor = DOT_COLOR[item.severity] ?? DOT_COLOR.info
  const dateLabel = format(parseISO(item.date), 'd. MMM', { locale: de })

  const content = (
    <div className="flex items-center gap-2.5 py-2 border-b border-line last:border-0">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      <div className="flex-1 min-w-0">
        <span className="text-xs text-ink-3 mr-1.5">{dateLabel}</span>
        {item.person_name && (
          <span className="text-xs font-medium text-ink mr-1.5">{item.person_name}</span>
        )}
        <span className="text-xs text-ink-2">{item.message}</span>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        to={href}
        className="block hover:bg-paper/50 -mx-2 px-2 rounded-lg transition-colors"
      >
        {content}
      </Link>
    )
  }
  return content
}
