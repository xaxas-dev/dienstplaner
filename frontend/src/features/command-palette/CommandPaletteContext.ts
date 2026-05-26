import { createContext, useContext } from 'react'

interface CommandPaletteContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return ctx
}
