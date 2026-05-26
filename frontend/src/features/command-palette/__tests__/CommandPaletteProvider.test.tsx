import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CommandPaletteProvider } from '../CommandPaletteProvider'
import { useCommandPalette } from '../useCommandPalette'

vi.mock('../CommandPalette', () => ({
  CommandPalette: () => null,
}))

function TestConsumer() {
  const { isOpen } = useCommandPalette()
  return <div data-testid="state">{isOpen ? 'open' : 'closed'}</div>
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CommandPaletteProvider>{children}</CommandPaletteProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CommandPaletteProvider', () => {
  it('starts closed', () => {
    render(<TestConsumer />, { wrapper: Wrapper })
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('opens on Ctrl+K', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(screen.getByTestId('state').textContent).toBe('open')
  })

  it('opens on Meta+K', async () => {
    render(<TestConsumer />, { wrapper: Wrapper })
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(screen.getByTestId('state').textContent).toBe('open')
  })

  it('throws when useCommandPalette used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow(
      'useCommandPalette must be used within CommandPaletteProvider'
    )
    spy.mockRestore()
  })
})
