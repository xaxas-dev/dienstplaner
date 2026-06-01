import { useLocation } from 'react-router-dom'
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Building2,
  Clock,
  Award,
  Shield,
  Settings,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Avatar } from '@/components/dp/Avatar'
import { LogoMark } from '@/components/dp/LogoMark'
import { cn } from '@/lib/utils'
import { useUserProfile } from '@/stores/useUserProfile'
import { ProfileEditModal } from '@/components/dp/ProfileEditModal'

interface NavItem {
  label: string
  to: string
  icon: React.ElementType
}

const mainNavItems: NavItem[] = [
  { label: 'Heute', to: '/heute', icon: LayoutDashboard },
  { label: 'Plan', to: '/plans', icon: Calendar },
  { label: 'Ärzte', to: '/doctors', icon: Users },
  { label: 'Stationen', to: '/departments', icon: Building2 },
  { label: 'Schichttypen', to: '/shift-types', icon: Clock },
  { label: 'Qualifikationen', to: '/qualifications', icon: Award },
  // Shield statt Settings2 — semantisch klarer, keine Verwechslung mit echtem Settings-Icon
  { label: 'Sonderregelungen', to: '/rule-overrides', icon: Shield },
]

export function MiniRail() {
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const { name } = useUserProfile()

  function isActive(to: string) {
    if (to === '/heute') return location.pathname === '/heute' || location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  function railItemClass(active: boolean) {
    return cn(
      'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
      active
        ? 'bg-[#C66A3D] text-[#FFF8EF]'
        : 'text-ink-2 hover:bg-line hover:text-ink',
    )
  }

  return (
    <aside className="w-[60px] shrink-0 h-screen bg-card border-r border-line flex flex-col items-center py-3 gap-1">
      {/* Logo-Tile */}
      <NavLink to="/heute" aria-label="Dashboard" className="mb-1 shrink-0 rounded-xl transition-opacity hover:opacity-80">
        <LogoMark size={38} radius={12} />
      </NavLink>

      {/* Divider */}
      <div className="w-6 h-px bg-line my-1 shrink-0" />

      {/* Haupt-Navigation */}
      {mainNavItems.map((item) => {
        const Icon = item.icon
        const active = isActive(item.to)
        return (
          <Tooltip key={item.to} delayDuration={300}>
            <TooltipTrigger asChild>
              <NavLink to={item.to} className={railItemClass(active)} aria-label={item.label}>
                <Icon className="size-[18px]" aria-hidden />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Einstellungen */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <NavLink to="/settings" className={railItemClass(isActive('/settings'))} aria-label="Einstellungen">
            <Settings className="size-[18px]" aria-hidden />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">Einstellungen</TooltipContent>
      </Tooltip>

      {/* Avatar / Profil */}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="mt-1 rounded-full hover:opacity-80 transition-opacity"
        aria-label="Profil bearbeiten"
      >
        <Avatar name={name} id="profile" size={32} />
      </button>
      <ProfileEditModal open={profileOpen} onOpenChange={setProfileOpen} />
    </aside>
  )
}
