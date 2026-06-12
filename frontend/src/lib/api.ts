export interface ValidationFieldError {
  loc: (string | number)[]
  msg: string
  type: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly validationErrors?: ValidationFieldError[],
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json()
    // FastAPI 422: { detail: ValidationError[] }
    if (response.status === 422 && Array.isArray(body.detail)) {
      return new ApiError(response.status, 'Validierungsfehler', body.detail as ValidationFieldError[])
    }
    // Our custom errors: { detail: string }
    const detail = typeof body.detail === 'string' ? body.detail : `HTTP ${response.status}`
    return new ApiError(response.status, detail)
  } catch {
    return new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> =
    body !== undefined ? { 'Content-Type': 'application/json' } : {}
  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw await parseError(response)
  }
  if (response.status === 204) {
    return undefined as T
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
  return request<void>('DELETE', path)
}

export async function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  // Do NOT set Content-Type — browser sets multipart boundary automatically
  const response = await fetch(path, { method: 'POST', body: formData })
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
