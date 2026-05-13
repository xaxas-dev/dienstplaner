import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandBar } from '../CommandBar'

// vi.hoisted sorgt dafür, dass die Variable vor dem Hoisting von vi.mock verfügbar ist
const { mockToastInfo } = vi.hoisted(() => ({ mockToastInfo: vi.fn() }))

vi.mock('sonner', () => ({
  toast: { info: mockToastInfo, success: vi.fn(), error: vi.fn() },
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

  it('Klick auf Suchfeld-Button zeigt Toast', async () => {
    const user = userEvent.setup()
    render(<CommandBar title="Plan" showSearch />)
    // Suchfeld-Button hat SVG + Text + ⌘K-Chip; über role + data-testid oder via Text
    const searchBtn = screen.getByRole('button', { name: /⌘k/i })
    await user.click(searchBtn)
    expect(mockToastInfo).toHaveBeenCalledWith('Command Palette kommt in M1-012')
  })

  it('blendet Suchfeld aus wenn showSearch=false', () => {
    render(<CommandBar title="Plan" showSearch={false} />)
    expect(screen.queryByText('⌘K')).toBeNull()
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
