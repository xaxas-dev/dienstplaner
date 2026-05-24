import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TodayPage } from '../TodayPage'
import type { DashboardSummary, PlanWithRelations } from '@/lib/types'

// --- Mocks ---

vi.mock('../useCurrentPlan', () => ({
  useCurrentPlan: vi.fn(),
  currentPlanKeys: { all: ['currentPlan'], byDate: (d: string) => ['currentPlan', d] },
}))

vi.mock('../useDashboardSummary', () => ({
  useDashboardSummary: vi.fn(),
  dashboardKeys: { all: ['dashboard'], byPlan: (id: number) => ['dashboard', id] },
}))

import { useCurrentPlan } from '../useCurrentPlan'
import { useDashboardSummary } from '../useDashboardSummary'

const mockUseCurrentPlan = vi.mocked(useCurrentPlan)
const mockUseDashboardSummary = vi.mocked(useDashboardSummary)

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const MOCK_PLAN = { id: 1, name: 'Mai 2026', valid_from: '2026-05-01', valid_to: '2026-05-31' } as unknown as PlanWithRelations

const MOCK_SUMMARY: DashboardSummary = {
  plan_id: 1,
  date: '2026-05-15',
  kpis: { coverage_pct: 0.75, open_shifts: 3, conflicts: 1, on_leave: 2 },
  today_shifts: [
    {
      shift_type_name: 'V-Dienst',
      shift_type_short_name: 'V',
      time_label: null,
      doctors: [{ id: 1, name: 'Max Muster', initials: 'MM' }],
    },
  ],
  coverage_by_department: [
    { department_name: 'Neurologie', filled: 2, total: 3, pct: 0.666 },
  ],
  attention: [
    { date: '2026-05-15', person_name: 'Dr. Smith', message: 'Konflikt', severity: 'error' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TodayPage – Empty-State', () => {
  beforeEach(() => {
    mockUseCurrentPlan.mockReturnValue({ data: null } as ReturnType<typeof useCurrentPlan>)
    mockUseDashboardSummary.mockReturnValue({ data: undefined } as ReturnType<typeof useDashboardSummary>)
  })

  it('rendert ohne Crash', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getAllByText(/Heute/).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt KPI-Tiles mit — wenn kein Plan', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  it('zeigt Empty-State in Karten', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getAllByText(/kein plan für diesen monat/i).length).toBeGreaterThanOrEqual(1)
  })

  it('CTA zeigt "Plan anlegen"', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText(/plan anlegen/i)).toBeInTheDocument()
  })
})

describe('TodayPage – Voll-State', () => {
  beforeEach(() => {
    mockUseCurrentPlan.mockReturnValue({ data: MOCK_PLAN } as ReturnType<typeof useCurrentPlan>)
    mockUseDashboardSummary.mockReturnValue({ data: MOCK_SUMMARY } as ReturnType<typeof useDashboardSummary>)
  })

  it('rendert ohne Crash', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getAllByText(/Heute/).length).toBeGreaterThanOrEqual(1)
  })

  it('zeigt KPI coverage_pct als Prozent', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('zeigt open_shifts', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('zeigt Shift-Typ in Heute im Dienst', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText('V-Dienst')).toBeInTheDocument()
  })

  it('zeigt Attention-Item', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText('Konflikt')).toBeInTheDocument()
  })

  it('zeigt Coverage-Bar für Neurologie', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText('Neurologie')).toBeInTheDocument()
  })

  it('CTA zeigt Plan-Name-Link', () => {
    render(<Wrapper><TodayPage /></Wrapper>)
    expect(screen.getByText(/Zum Plan: Mai 2026/)).toBeInTheDocument()
  })
})
