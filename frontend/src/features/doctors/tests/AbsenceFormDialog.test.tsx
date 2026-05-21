import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AbsenceFormDialog } from '../AbsenceFormDialog'

afterEach(cleanup)

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

const noop = vi.fn()

function renderForm() {
  render(
    <Wrapper>
      <AbsenceFormDialog open={true} onOpenChange={noop} doctorId={1} />
    </Wrapper>,
  )
}

async function submit() {
  const btn = screen.getByRole('button', { name: /^Speichern$/i })
  await userEvent.click(btn)
}

describe('AbsenceFormDialog – Happy Path', () => {
  it('rendert das Formular mit allen Pflichtfeldern', () => {
    renderForm()
    expect(screen.getByText('Neue Abwesenheit')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    expect(dateInputs).toHaveLength(2)
    expect(screen.getByRole('button', { name: /^Speichern$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Abbrechen/i })).toBeInTheDocument()
  })

  it('zeigt den Titel "Abwesenheit bearbeiten" wenn ein Absence übergeben wird', () => {
    const absence = {
      id: 1,
      doctor_id: 1,
      absence_type: 'URLAUB' as const,
      valid_from: '2026-01-01',
      valid_to: '2026-01-15',
      notes: null,
      created_at: '',
      updated_at: '',
    }
    render(
      <Wrapper>
        <AbsenceFormDialog open={true} onOpenChange={noop} doctorId={1} absence={absence} />
      </Wrapper>,
    )
    expect(screen.getByText('Abwesenheit bearbeiten')).toBeInTheDocument()
  })
})

describe('AbsenceFormDialog – Validierung', () => {
  it('zeigt Fehler wenn valid_from > valid_to', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-01' } })

    // Typ muss gesetzt sein, damit die Refine-Validierung greift
    const trigger = screen.getByRole('combobox')
    await userEvent.click(trigger)
    const options = await screen.findAllByText('Urlaub')
    await userEvent.click(options[options.length - 1])

    await submit()

    await waitFor(() => {
      expect(
        screen.getByText(/Enddatum muss nach dem Startdatum liegen/i),
      ).toBeInTheDocument()
    })
  })

  it('zeigt Fehler wenn absence_type fehlt', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-15' } })

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Abwesenheitstyp ist erforderlich/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler wenn valid_from fehlt', async () => {
    renderForm()

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Startdatum ist erforderlich/i)).toBeInTheDocument()
    })
  })
})
