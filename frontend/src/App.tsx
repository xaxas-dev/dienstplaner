import { useState } from 'react'
import { checkHealth } from './lib/api'

type Status = 'idle' | 'connected' | 'error'

export default function App() {
  const [status, setStatus] = useState<Status>('idle')

  const handleCheck = async () => {
    try {
      await checkHealth()
      setStatus('connected')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Dienstplaner</h1>
        <p className="text-gray-500">Schichtplanungs-Software</p>
        <button
          onClick={() => void handleCheck()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Verbindung prüfen
        </button>
        {status === 'connected' && (
          <p className="text-green-600 font-medium">Verbunden</p>
        )}
        {status === 'error' && (
          <p className="text-red-600 font-medium">Keine Verbindung</p>
        )}
      </div>
    </div>
  )
}
