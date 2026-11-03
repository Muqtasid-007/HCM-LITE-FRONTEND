import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Breadcrumbs } from '../components/common/Breadcrumbs'
import { Navbar } from '../components/common/Navbar'
import { Sidebar } from '../components/common/Sidebar'

export function DashboardLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[260px_1fr]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-h-screen flex-col">
        <Navbar onMenu={() => setOpen(true)} />
        <main className="flex-1 space-y-4 p-4 lg:p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">HCM Lite · JWT Bearer API</footer>
      </div>
    </div>
  )
}
