import { Link, useLocation } from 'react-router-dom'

const labels = {
  dashboard: 'Dashboard',
  organization: 'Organization',
  users: 'Users',
  employees: 'Employees',
  new: 'New',
  edit: 'Edit',
  attendance: 'Attendance',
  leave: 'Leave',
  payroll: 'Payroll',
  payslips: 'Payslip',
  'ai-assistant': 'AI Assistant',
  comms: 'Comms & Audit',
  'change-password': 'Change password',
}

export function Breadcrumbs() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)
  if (!parts.length) return null
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/dashboard" className="hover:text-slate-800">
            Home
          </Link>
        </li>
        {parts.map((part, index) => {
          const href = `/${parts.slice(0, index + 1).join('/')}`
          const label = labels[part] || (part.length === 24 ? 'Detail' : part)
          const last = index === parts.length - 1
          return (
            <li key={href} className="flex items-center gap-1">
              <span>/</span>
              {last ? (
                <span className="font-medium text-slate-800">{label}</span>
              ) : (
                <Link to={href} className="hover:text-slate-800">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
