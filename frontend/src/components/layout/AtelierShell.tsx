import { Outlet } from 'react-router-dom'
import { MiniRail } from './MiniRail'

export function AtelierShell() {
  return (
    <div className="flex h-screen bg-paper">
      <MiniRail />
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
