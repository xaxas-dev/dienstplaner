import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { INAExclusionFormDialog } from '../INAExclusionFormDialog'

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
      <INAExclusionFormDialog open={true} onOpenChange={noop} doctorId={1} />
    </Wrapper>,
  )
}

async function submit() {
  const btn = screen.getByRole('button', { name: /^Speichern$/i })
  await userEvent.click(btn)
}

describe('INAExclusionFormDialog – Validierung', () => {
  it('zeigt Fehler wenn valid_from > valid_to', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-01' } })

    // Reason muss gesetzt sein, damit die Refine-Validierung greift
    const trigger = screen.getByRole('combobox')
    await userEvent.click(trigger)
    const options = await screen.findAllByText('Schwangerschaft')
    await userEvent.click(options[options.length - 1])

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Enddatum muss nach dem Startdatum liegen/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler wenn reason fehlt', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } })

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Grund ist erforderlich/i)).toBeInTheDocument()
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
