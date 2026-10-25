import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/authApi'
import { orgApi } from '../api/orgApi'
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/storage'
import { companyToday, currentPolicy } from '../utils/format'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken())
  const [user, setUser] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [initializationRequired, setInitializationRequired] = useState(null)
  const [loading, setLoading] = useState(true)

  const persistToken = useCallback((next) => {
    setStoredToken(next)
    setToken(next)
  }, [])

  const clearSession = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
    setOrganization(null)
  }, [])

  const loadOrganization = useCallback(async (role) => {
    if (role !== 'Admin' && role !== 'HR') {
      setOrganization(null)
      return
    }
    try {
      const data = await orgApi.getOrganization()
      setOrganization(data)
    } catch {
      setOrganization(null)
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const data = await authApi.me()
    setUser(data)
    await loadOrganization(data?.role)
    return data
  }, [loadOrganization])

  const bootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const status = await authApi.setupStatus()
      setInitializationRequired(status?.isSetupComplete === false || Boolean(status?.initializationRequired))
      if (getStoredToken()) {
        try {
          await refreshUser()
        } catch {
          clearSession()
        }
      }
    } catch (error) {
      const url = error.requestUrl || 'http://localhost:5000/api/setup/status'
      console.error(`[auth] Could not determine setup status from ${url}`, error)
      setInitializationRequired(false)
    } finally {
      setLoading(false)
    }
  }, [clearSession, refreshUser])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  useEffect(() => {
    function onUnauthorized() {
      clearSession()
    }
    window.addEventListener('hcm:unauthorized', onUnauthorized)
    return () => window.removeEventListener('hcm:unauthorized', onUnauthorized)
  }, [clearSession])

  const login = useCallback(
    async (email, password) => {
      const data = await authApi.login({ email, password })
      persistToken(data.token)
      setUser(data.user)
      await loadOrganization(data.user?.role)
      return data
    },
    [loadOrganization, persistToken],
  )

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) await authApi.logout()
    } catch {
      // Session is cleared locally regardless of network outcome.
    }
    clearSession()
  }, [clearSession])

  const refreshOrganization = useCallback(async () => {
    await loadOrganization(user?.role)
  }, [loadOrganization, user?.role])

  const policy = useMemo(() => {
    const tz = currentPolicy(organization?.company)?.timezone || 'Asia/Karachi'
    return currentPolicy(organization?.company, companyToday(tz))
  }, [organization])

  const value = useMemo(
    () => ({
      token,
      user,
      organization,
      policy,
      units: organization?.units || [],
      initializationRequired,
      loading,
      isAuthenticated: Boolean(token && user),
      mustChangePassword: Boolean(user?.mustChangePassword),
      login,
      logout,
      refreshUser,
      refreshOrganization,
      persistToken,
      clearSession,
      setInitializationRequired,
    }),
    [
      clearSession,
      initializationRequired,
      loading,
      login,
      logout,
      organization,
      persistToken,
      policy,
      refreshOrganization,
      refreshUser,
      token,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function hasRole(user, roles = []) {
  if (!roles.length) return true
  return roles.includes(user?.role)
}

export function isStaff(user) {
  return user?.role === 'Admin' || user?.role === 'HR'
}

export function canCheckIn(user) {
  return Boolean(user?.employeeId) && (user?.role === 'Employee' || user?.role === 'HR')
}
