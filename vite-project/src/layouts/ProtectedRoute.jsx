import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader } from '../components/feedback/ErrorBoundary'
import { useAuth, hasRole } from '../context/AuthContext'

export function ProtectedRoute({ roles = [] }) {
  const { loading, isAuthenticated, mustChangePassword, initializationRequired, user } = useAuth()
  const location = useLocation()

  if (loading || initializationRequired === null) return <Loader label="Checking session" />
  if (initializationRequired && !isAuthenticated) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  if (!mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/dashboard" replace />
  }
  if (roles.length && !hasRole(user, roles)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export function PublicRoute({ children, setupOnly = false }) {
  const { loading, isAuthenticated, mustChangePassword, initializationRequired } = useAuth()
  if (loading || initializationRequired === null) return <Loader label="Loading" />
  if (setupOnly) {
    if (!initializationRequired) return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
    return children
  }
  if (initializationRequired) return <Navigate to="/setup" replace />
  if (isAuthenticated) return <Navigate to={mustChangePassword ? '/change-password' : '/dashboard'} replace />
  return children
}
