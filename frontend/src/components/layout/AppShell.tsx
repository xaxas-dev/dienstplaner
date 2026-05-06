import { NavLink, Outlet } from 'react-router-dom'
import { Users, Building2, Clock, Award, Settings, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
  disabled?: boolean
}

const navItems: NavItem[] = [
  { label: 'Ärzte', to: '/doctors', icon: Users },
  { label: 'Stationen', to: '/departments', icon: Building2, disabled: true },
  { label: 'Schichttypen', to: '/shift-types', icon: Clock, disabled: true },
  { label: 'Qualifikationen', to: '/qualifications', icon: Award, disabled: true },
  { label: 'Tarif-Overrides', to: '/rule-overrides', icon: Settings, disabled: true },
  { label: 'Pläne', to: '/plans', icon: CalendarDays, disabled: true },
]

export function AppShell() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-6 py-5 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">Dienstplaner</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Neurologie UKSH Lübeck</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  aria-disabled="true"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>

      {/* Hauptbereich */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
