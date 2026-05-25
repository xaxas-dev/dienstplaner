import { useState, useEffect } from 'react'
import { useCommandPalette } from './useCommandPalette'
import { useNavigationItems } from './items/navigation'
import { useQuickActions } from './items/quickActions'
import { useEntityItems } from './items/useEntityItems'
import {
  CommandDialog, CommandInput, CommandList,
  CommandGroup, CommandItem, CommandEmpty,
} from '@/components/ui/command'
import type { CommandItemDef } from './items/types'
import { getRecents, pushRecent } from './recents'
import type { RecentItem } from './recents'

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const navigationItems = useNavigationItems()
  const quickActions = useQuickActions()
  const { doctorItems, planItems, departmentItems } = useEntityItems(isOpen)

  const [recents, setRecents] = useState<RecentItem[]>([])
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (isOpen) setRecents(getRecents())
  }, [isOpen])

  function handleSelect(item: CommandItemDef) {
    pushRecent({ id: item.id, label: item.label, group: item.group })
    setRecents(getRecents())
    close()
    item.onSelect()
  }

  function handleRecentSelect(recent: RecentItem) {
    const allItems = [
      ...navigationItems,
      ...quickActions,
      ...doctorItems,
      ...planItems,
      ...departmentItems,
    ]
    const found = allItems.find((item) => item.id === recent.id)
    if (found) {
      handleSelect(found)
    } else {
      // Item no longer exists — remove from local state; next open will reload from storage
      setRecents((prev) => prev.filter((r) => r.id !== recent.id))
    }
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <CommandInput
        placeholder="Suchen oder Befehl…"
        onValueChange={setInputValue}
      />
      <CommandList>
        <CommandEmpty>Keine Treffer</CommandEmpty>
        {recents.length > 0 && inputValue === '' && (
          <CommandGroup heading="Zuletzt verwendet">
            {recents.map((recent) => (
              <CommandItem
                key={recent.id}
                value={recent.label}
                onSelect={() => handleRecentSelect(recent)}
              >
                {recent.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                onSelect={() => handleSelect(item)}
              >
                {Icon && <Icon className="mr-2 size-4 shrink-0 text-ink-3" />}
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandGroup heading="Aktionen">
          {quickActions.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.id}
                value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                onSelect={() => handleSelect(item)}
              >
                {Icon && <Icon className="mr-2 size-4 shrink-0 text-ink-3" />}
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        {doctorItems.length > 0 && (
          <CommandGroup heading="Ärzte">
            {doctorItems.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => handleSelect(item)}
                >
                  {Icon && <Icon className="mr-2 size-4 shrink-0 text-ink-3" />}
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
        {planItems.length > 0 && (
          <CommandGroup heading="Pläne">
            {planItems.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => handleSelect(item)}
                >
                  {Icon && <Icon className="mr-2 size-4 shrink-0 text-ink-3" />}
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
        {departmentItems.length > 0 && (
          <CommandGroup heading="Stationen">
            {departmentItems.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                  onSelect={() => handleSelect(item)}
                >
                  {Icon && <Icon className="mr-2 size-4 shrink-0 text-ink-3" />}
                  {item.label}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
