import { useCommandPalette } from './useCommandPalette'
import { useNavigationItems } from './items/navigation'
import { useQuickActions } from './items/quickActions'
import {
  CommandDialog, CommandInput, CommandList,
  CommandGroup, CommandItem, CommandEmpty,
} from '@/components/ui/command'
import type { CommandItemDef } from './items/types'

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const navigationItems = useNavigationItems()
  const quickActions = useQuickActions()

  function handleSelect(item: CommandItemDef) {
    close()
    item.onSelect()
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <CommandInput placeholder="Suchen oder Befehl…" />
      <CommandList>
        <CommandEmpty>Keine Treffer</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
              onSelect={() => handleSelect(item)}
            >
              {item.icon && <item.icon className="mr-2 size-4 shrink-0 text-ink-3" />}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Aktionen">
          {quickActions.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
              onSelect={() => handleSelect(item)}
            >
              {item.icon && <item.icon className="mr-2 size-4 shrink-0 text-ink-3" />}
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
