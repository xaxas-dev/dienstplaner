import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EmploymentPeriodForm } from '../EmploymentPeriodForm'

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
      <EmploymentPeriodForm open={true} onOpenChange={noop} doctorId={1} />
    </Wrapper>,
  )
}

async function submit() {
  const btn = screen.getByRole('button', { name: /^Speichern$/i })
  await userEvent.click(btn)
}

describe('EmploymentPeriodForm – Validierung', () => {
  it('zeigt Fehler wenn valid_from > valid_to', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-12-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-01-01' } })

    const percentInput = screen.getByRole('spinbutton')
    fireEvent.change(percentInput, { target: { value: '50', valueAsNumber: 50 } })

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Enddatum muss nach dem Startdatum liegen/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler bei employment_percentage = 0', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } })

    const percentInput = screen.getByRole('spinbutton')
    fireEvent.change(percentInput, { target: { value: '0', valueAsNumber: 0 } })

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Mindestens 1%/i)).toBeInTheDocument()
    })
  })

  it('zeigt Fehler bei employment_percentage = 101', async () => {
    renderForm()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } })

    const percentInput = screen.getByRole('spinbutton')
    fireEvent.change(percentInput, { target: { value: '101', valueAsNumber: 101 } })

    await submit()

    await waitFor(() => {
      expect(screen.getByText(/Maximal 100%/i)).toBeInTheDocument()
    })
  })
})
