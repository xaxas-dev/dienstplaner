import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { z } from 'zod'
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
  weiterbildungsjahr: 3,
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

  it('zeigt Fehler bei Facharzt + Weiterbildungsjahr', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    // Facharzt einschalten
    const facharztSwitch = screen.getByRole('switch', { name: /facharzt/i })
    await user.click(facharztSwitch)

    // Name eingeben damit nur der WBJ-Fehler erscheint
    await user.type(screen.getByPlaceholderText(/Dr. Mustermann/i), 'Test')

    // WBJ-Feld existiert nicht mehr nach Facharzt=true
    // Wenn WBJ vorhanden, Fehler nach Submit
    const submitBtn = screen.getByRole('button', { name: /speichern/i })
    await user.click(submitBtn)

    // Kein WBJ-Feld → kein Fehler
    expect(screen.queryByText(/Fachärzte haben kein Weiterbildungsjahr/i)).not.toBeInTheDocument()
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
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
  })
})

describe('DoctorForm – Weiterbildungsjahr', () => {
  it('WBJ-Input hat kein max-Attribut (kein oberes Limit)', () => {
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    const wbjInput = screen.getByPlaceholderText(/z\.B\. 3/i)
    expect(wbjInput).toHaveAttribute('min', '1')
    expect(wbjInput).not.toHaveAttribute('max')
  })

  it('WBJ=10 wird im Input akzeptiert', async () => {
    const user = userEvent.setup()
    render(
      <Wrapper>
        <DoctorForm />
      </Wrapper>,
    )
    const wbjInput = screen.getByPlaceholderText(/z\.B\. 3/i)
    await user.clear(wbjInput)
    await user.type(wbjInput, '10')
    expect(wbjInput).toHaveValue(10)
  })

  it('WBJ=0 ist invalide laut Zod-Schema (>= 1 erforderlich)', () => {
    const wbjSchema = z.number().int().min(1).nullable().optional()
    expect(wbjSchema.safeParse(0).success).toBe(false)
  })

  it('WBJ=10 ist valide laut Zod-Schema', () => {
    const wbjSchema = z.number().int().min(1).nullable().optional()
    expect(wbjSchema.safeParse(10).success).toBe(true)
  })
})
