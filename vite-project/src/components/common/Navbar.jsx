import { Bell, LogOut, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { commsApi } from '../../api/commsApi'
import { useAuth } from '../../context/AuthContext'
import { Badge } from '../ui/Card'
import { roleLabel } from '../../utils/format'

export function Navbar({ onMenu }) {
  const { user, logout, organization } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false
    commsApi
      .notifications({ page: 1, limit: 20 })
      .then((data) => {
        if (cancelled) return
        const items = data?.items || []
        setUnread(items.filter((item) => !item.readAt).length)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-900">{organization?.company?.name || 'HCM Lite'}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="emerald">{roleLabel(user?.role)}</Badge>
        <Link to="/comms" className="relative rounded-lg p-2 hover:bg-slate-100" aria-label="Notifications">
          <Bell size={18} />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
          ) : null}
        </Link>
        <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  )
}
