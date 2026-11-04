import { NavLink } from 'react-router-dom'
import {
  Bot,
  Building2,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Users,
  UserRound,
  Wallet,
  Clock3,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'HR', 'Employee'] },
  { to: '/organization', label: 'Organization', icon: Building2, roles: ['Admin', 'HR'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['Admin'] },
  { to: '/employees', label: 'Employees', icon: UserRound, roles: ['Admin', 'HR'] },
  { to: '/attendance', label: 'Attendance', icon: Clock3, roles: ['Admin', 'HR', 'Employee'] },
  { to: '/leave', label: 'Leave', icon: CalendarDays, roles: ['Admin', 'HR', 'Employee'] },
  { to: '/payroll', label: 'Payroll', icon: Wallet, roles: ['Admin', 'HR', 'Employee'] },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot, roles: ['Admin', 'HR', 'Employee'] },
  { to: '/comms', label: 'Comms & Audit', icon: Megaphone, roles: ['Admin', 'HR', 'Employee'] },
]

export function Sidebar({ onNavigate }) {
  const { user } = useAuth()
  const visible = links.filter((link) => link.roles.includes(user?.role))
  if (user?.employeeId) {
    visible.push({
      to: `/employees/${user.employeeId}`,
      label: 'My profile',
      icon: UserRound,
      roles: ['Admin', 'HR', 'Employee'],
    })
  }

  return (
    <aside className="flex h-full flex-col bg-slate-900 text-slate-200">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
          <rect width="32" height="32" rx="8" fill="#059669" />
          <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400">HCM LITE</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-white">People Ops</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
        {visible.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                  isActive ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {link.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
