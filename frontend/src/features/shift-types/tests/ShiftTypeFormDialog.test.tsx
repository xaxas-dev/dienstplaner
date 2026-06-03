import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ShiftTypeFormDialog } from '../ShiftTypeFormDialog'

afterEach(cleanup)

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function renderDialog() {
  render(
    <Wrapper>
      <ShiftTypeFormDialog open={true} onOpenChange={vi.fn()} />
    </Wrapper>,
  )
}

describe('ShiftTypeFormDialog – Validierung', () => {
  it('zeigt Fehler wenn kein Tag-Typ ausgewählt ist', async () => {
    renderDialog()

    // Name + Kurzname setzen damit das die einzige Fehlerquelle ist
    fireEvent.change(screen.getByPlaceholderText(/Tagdienst/i), {
      target: { value: 'Nachtdienst' },
    })
    fireEvent.change(screen.getByLabelText(/Kurzname/i), {
      target: { value: 'N' },
    })

    // Beide Tag-Typen deaktivieren
    const switches = screen.getAllByRole('switch')
    // applies_on_weekdays ist der erste Switch (standardmäßig true → ausschalten)
    await userEvent.click(switches[0])
    // applies_on_weekend ist standardmäßig false → bereits aus

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Mindestens ein Tag-Typ muss aktiv sein/i),
      ).toBeInTheDocument()
    })
  })

  it('erlaubt Mitternachts-Schicht (start_time > end_time)', async () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText(/Tagdienst/i), {
      target: { value: 'Nachtdienst' },
    })
    fireEvent.change(screen.getByLabelText(/Kurzname/i), {
      target: { value: 'N' },
    })

    // Zeitfelder setzen: start > end ist erlaubt
    const timeInputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '21:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '07:00' } })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    // Kein Validierungs-Fehler für start_time > end_time
    await waitFor(() => {
      expect(
        screen.queryByText(/Start- und Endzeit dürfen nicht identisch/i),
      ).not.toBeInTheDocument()
    })

    // Hinweis auf Mitternachts-Schicht erscheint
    expect(screen.getByText(/Schicht über Mitternacht/i)).toBeInTheDocument()
  })

  it('zeigt Fehler bei identischen Zeiten', async () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText(/Tagdienst/i), {
      target: { value: 'Test' },
    })
    fireEvent.change(screen.getByLabelText(/Kurzname/i), {
      target: { value: 'T' },
    })

    const timeInputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '08:00' } })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Start- und Endzeit dürfen nicht identisch/i),
      ).toBeInTheDocument()
    })
  })
})

describe('ShiftTypeFormDialog – Filter-Gruppe', () => {
  it('rendert Filter-Gruppe Feld und nimmt Eingaben an', async () => {
    renderDialog()

    const filterGroupInput = screen.getByLabelText(/Filter-Gruppe/i)
    expect(filterGroupInput).toBeInTheDocument()
    expect((filterGroupInput as HTMLInputElement).value).toBe('')

    await userEvent.type(filterGroupInput, 'Nacht')
    expect((filterGroupInput as HTMLInputElement).value).toBe('Nacht')
  })

  it('zeigt Filter-Gruppe Feld als optional (kein Pflicht-Fehler)', async () => {
    renderDialog()

    fireEvent.change(screen.getByPlaceholderText(/Tagdienst/i), {
      target: { value: 'Tagdienst' },
    })
    fireEvent.change(screen.getByLabelText(/Kurzname/i), {
      target: { value: 'T' },
    })

    await userEvent.click(screen.getByRole('button', { name: /^Speichern$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/Filter-Gruppe.*erforderlich/i)).not.toBeInTheDocument()
    })
  })
})
