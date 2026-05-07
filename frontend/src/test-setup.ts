import '@testing-library/jest-dom'

// Radix UI uses ResizeObserver — jsdom doesn't implement it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Radix UI uses PointerEvent — jsdom doesn't implement it fully
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).PointerEvent = class PointerEvent extends MouseEvent {
  constructor(type: string, props?: PointerEventInit) {
    super(type, props)
  }
}

// Radix UI uses hasPointerCapture — jsdom doesn't implement it
window.HTMLElement.prototype.hasPointerCapture = () => false
window.HTMLElement.prototype.setPointerCapture = () => {}
window.HTMLElement.prototype.releasePointerCapture = () => {}

// Radix UI Select calls scrollIntoView on selected items — jsdom doesn't implement it
Element.prototype.scrollIntoView = () => {}

// suppress missing pointer events on element
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
