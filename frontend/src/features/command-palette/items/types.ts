import type { LucideIcon } from 'lucide-react'

export interface CommandItemDef {
  id: string
  label: string
  group: 'navigation' | 'actions' | 'doctors' | 'plans' | 'departments'
  icon?: LucideIcon
  keywords?: string[]
  onSelect: () => void
}
