import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandBar } from '../CommandBar'

// Mock useCommandPalette so tests don't need a real provider
const mockOpen = vi.fn()
vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: mockOpen, close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

// Mock platform — jsdom reports Win32, but we make it explicit
vi.mock('@/lib/platform', () => ({
  isMac: () => false,
  getModifierKey: () => 'ctrl',
  getModifierGlyph: () => 'Strg',
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CommandBar', () => {
  it('rendert title ohne titleAccent', () => {
    render(<CommandBar title="Mai 2026" />)
    expect(screen.getByText('Mai 2026')).toBeInTheDocument()
  })

  it('rendert titleAccent und title nebeneinander', () => {
    render(<CommandBar titleAccent="Heute" title="Mittwoch, 13. Mai 2026" />)
    expect(screen.getByText('Heute')).toBeInTheDocument()
    expect(screen.getByText('Mittwoch, 13. Mai 2026')).toBeInTheDocument()
  })

  it('rendert titleAccent als em-Element (italic accent)', () => {
    render(<CommandBar titleAccent="Mai" title="2026" />)
    const em = screen.getByText('Mai')
    expect(em.tagName).toBe('EM')
  })

  it('rendert Filter-Chips', () => {
    const onClick = vi.fn()
    render(
      <CommandBar
        title="Plan"
        filters={[
          { label: '2 Wochen', active: true,  onClick },
          { label: '4 Wochen', active: false, onClick },
        ]}
      />
    )
    expect(screen.getByRole('button', { name: '2 Wochen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 Wochen' })).toBeInTheDocument()
  })

  it('Klick auf Filter-Chip ruft onClick auf', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <CommandBar
        title="Plan"
        filters={[{ label: '2 Wochen', active: false, onClick }]}
      />
    )
    await user.click(screen.getByRole('button', { name: '2 Wochen' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('Klick auf Suchfeld-Button öffnet Command Palette', async () => {
    const user = userEvent.setup()
    render(<CommandBar title="Plan" showSearch />)
    const searchBtn = screen.getByRole('button', { name: /strg\+k/i })
    await user.click(searchBtn)
    expect(mockOpen).toHaveBeenCalledOnce()
  })

  it('blendet Suchfeld aus wenn showSearch=false', () => {
    render(<CommandBar title="Plan" showSearch={false} />)
    expect(screen.queryByText('Strg+K')).toBeNull()
  })

  it('rendert Primärbutton und reagiert auf Klick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <CommandBar
        title="Plan"
        primaryAction={{ label: '+ Neuer Plan', onClick }}
      />
    )
    const btn = screen.getByRole('button', { name: /neuer plan/i })
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
