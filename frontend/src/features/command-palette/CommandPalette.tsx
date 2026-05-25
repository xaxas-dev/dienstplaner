import { useCommandPalette } from './CommandPaletteContext'
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command'

export function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) close() }}>
      <CommandInput placeholder="Suchen oder Befehl…" />
      <CommandList>
        <CommandEmpty>Keine Treffer</CommandEmpty>
      </CommandList>
    </CommandDialog>
  )
}
