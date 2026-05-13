import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MiniRail } from '../MiniRail'

vi.mock('@/lib/useSettings', () => ({
  useClinicName: () => ({
    data: { key: 'clinic_name', value: 'Testklinik UKSH', description: null, updated_at: '' },
  }),
}))

function Wrapper({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <TooltipProvider>
        <MiniRail />
      </TooltipProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MiniRail', () => {
  it('rendert alle Haupt-Nav-Items mit aria-label', () => {
    render(<Wrapper initialPath="/doctors" />)
    expect(screen.getByRole('link', { name: 'Ärzte' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stationen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Schichttypen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Qualifikationen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sonderregelungen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Heute' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toBeInTheDocument()
  })

  it('markiert aktive Route mit bg-ink-Klasse', () => {
    render(<Wrapper initialPath="/doctors" />)
    const activeLink = screen.getByRole('link', { name: 'Ärzte' })
    expect(activeLink.className).toContain('bg-ink')
  })

  it('markiert Sub-Routen korrekt (/doctors/123 → Ärzte aktiv)', () => {
    render(<Wrapper initialPath="/doctors/123" />)
    const activeLink = screen.getByRole('link', { name: 'Ärzte' })
    expect(activeLink.className).toContain('bg-ink')
  })

  it('inaktive Routes haben NICHT bg-ink-Klasse', () => {
    render(<Wrapper initialPath="/doctors" />)
    const inactiveLink = screen.getByRole('link', { name: 'Stationen' })
    expect(inactiveLink.className).not.toContain('bg-ink')
  })

  it('zeigt clinic_name Sub-Label aus dem Settings-Hook', () => {
    render(<Wrapper initialPath="/doctors" />)
    expect(screen.getByText('Testklinik UKSH')).toBeInTheDocument()
  })
})
