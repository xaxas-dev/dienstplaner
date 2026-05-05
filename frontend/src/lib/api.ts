const BASE_URL = '/api'

export async function checkHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${BASE_URL}/health`)
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  return response.json() as Promise<{ status: string; version: string }>
}
