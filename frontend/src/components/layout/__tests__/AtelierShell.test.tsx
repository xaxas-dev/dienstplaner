import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AtelierShell } from '../AtelierShell'

vi.mock('@/lib/useSettings', () => ({
  useClinicName: () => ({ data: { key: 'clinic_name', value: 'UKSH', description: null, updated_at: '' } }),
}))

function Wrapper({ children }: { children?: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/doctors']}>
        <TooltipProvider>
          <Routes>
            <Route element={<AtelierShell />}>
              <Route path="/doctors" element={children ?? <div>Outlet-Inhalt</div>} />
            </Route>
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AtelierShell', () => {
  it('rendert MiniRail (Nav-Links vorhanden)', () => {
    render(<Wrapper />)
    expect(screen.getByRole('link', { name: /ärzte/i })).toBeInTheDocument()
  })

  it('rendert Outlet-Inhalt', () => {
    render(<Wrapper><p>Seiten-Inhalt</p></Wrapper>)
    expect(screen.getByText('Seiten-Inhalt')).toBeInTheDocument()
  })

  it('hat keinen globalen Header (kein h1 in der Shell)', () => {
    render(<Wrapper />)
    // MiniRail hat kein h1 — das Logo ist ein div, kein heading
    const headings = screen.queryAllByRole('heading', { level: 1 })
    // Kein h1 außerhalb des Outlet-Inhalts
    headings.forEach((h) => {
      expect(h.closest('aside')).toBeNull()
    })
  })
})
