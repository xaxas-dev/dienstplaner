import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HolidayListPage } from '../HolidayListPage'
import type { Holiday } from '@/lib/types'

vi.mock('@/features/command-palette/useCommandPalette', () => ({
  useCommandPalette: () => ({ open: vi.fn(), close: vi.fn(), toggle: vi.fn(), isOpen: false }),
}))

vi.mock('../useHolidays', () => ({
  useHolidays: () => ({
    data: [
      { date: '2026-01-01', name: 'Neujahr', source: 'AUTO' } as Holiday,
      { date: '2026-06-19', name: 'Brückentag', source: 'MANUAL' } as Holiday,
    ],
    isLoading: false,
    isError: false,
  }),
  useCreateHoliday: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteHoliday: () => ({ mutate: vi.fn(), isPending: false }),
  useSeedHolidays: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HolidayListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('HolidayListPage', () => {
  it('rendert Feiertage aus Mock-Daten', () => {
    renderPage()
    expect(screen.getByText('Neujahr')).toBeInTheDocument()
    expect(screen.getByText('Brückentag')).toBeInTheDocument()
  })

  it('zeigt SH-Badge bei AUTO-Feiertagen', () => {
    renderPage()
    expect(screen.getByText('SH')).toBeInTheDocument()
  })
})
