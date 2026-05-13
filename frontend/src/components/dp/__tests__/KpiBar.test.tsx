import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiBar } from '../KpiBar'

describe('KpiBar', () => {
  it('rendert N Tiles', () => {
    render(
      <KpiBar tiles={[
        { label: 'Abdeckung',  value: '87%' },
        { label: 'Konflikte', value: 3 },
        { label: 'Im Urlaub', value: 1 },
      ]} />
    )
    expect(screen.getByText('Abdeckung')).toBeInTheDocument()
    expect(screen.getByText('Konflikte')).toBeInTheDocument()
    expect(screen.getByText('Im Urlaub')).toBeInTheDocument()
  })

  it('rendert leeren Container ohne Fehler', () => {
    expect(() => render(<KpiBar tiles={[]} />)).not.toThrow()
  })

  it('gibt value und label korrekt weiter', () => {
    render(<KpiBar tiles={[{ label: 'Test', value: '42%', sub: 'Sub-Info' }]} />)
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Sub-Info')).toBeInTheDocument()
  })

  it('übergibt tone an KpiTile (warn-Tile bekommt warn-Styling)', () => {
    const { container } = render(
      <KpiBar tiles={[{ label: 'Konflikte', value: 4, tone: 'warn' }]} />
    )
    // warn-Tone erzeugt bg-warn-bg im KpiTile
    expect(container.querySelector('.bg-warn-bg')).toBeInTheDocument()
  })
})
