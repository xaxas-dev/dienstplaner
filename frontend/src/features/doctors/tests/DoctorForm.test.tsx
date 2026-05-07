import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DoctorForm } from '../DoctorForm'
import type { Doctor } from '@/lib/types'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const mockDoctor: Doctor = {
  id: 1,
  name: 'Dr. Mustermann',
  short_name: 'MM',
  doctor_type: 'INTERNAL',
  weiterbildungsjahr: null,
  is_facharzt: false,
  active: true,
  entry_date: null,
  virtual_entry_date: null,
  notes: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  employment_periods: [],
  qualifications: [],
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('DoctorForm – Validierung', () => {
  it('zeigt Fehler bei leerem Namen', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    const submitBtn = screen.getByRole('button', { name: /speichern/i })
    await user.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument()
    })
  })
})

describe('DoctorForm – Felder', () => {
  it('rendert leere Felder ohne doctor-Prop', () => {
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    expect(screen.getByPlaceholderText(/Dr. Mustermann/i)).toHaveValue('')
  })

  it('füllt Felder aus doctor-Prop', () => {
    render(
      <Wrapper>
        <DoctorForm doctor={mockDoctor} />
      </Wrapper>,
    )
    expect(screen.getByDisplayValue('Dr. Mustermann')).toBeInTheDocument()
    expect(screen.getByDisplayValue('MM')).toBeInTheDocument()
  })

  it('kein WBJ-Eingabefeld im Formular', () => {
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    expect(screen.queryByPlaceholderText(/z\.B\. 3/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/weiterbildungsjahr/i)).not.toBeInTheDocument()
  })

  it('kein Hilfetext zum virtuellen Eintrittsdatum', () => {
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    expect(screen.queryByText(/Anrechnungszeiten/i)).not.toBeInTheDocument()
  })
})
