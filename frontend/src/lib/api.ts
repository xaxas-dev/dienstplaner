const BASE_URL = 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> =
    body !== undefined ? { 'Content-Type': 'application/json' } : {}
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>('PATCH', path, body)
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`)
  }
}
