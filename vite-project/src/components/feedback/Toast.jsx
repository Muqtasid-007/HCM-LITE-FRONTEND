import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((toast) => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, type: 'info', ...toast }])
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, toast.duration || 4500)
  }, [])

  useEffect(() => {
    function onToast(event) {
      push(event.detail || {})
    }
    window.addEventListener('hcm:toast', onToast)
    return () => window.removeEventListener('hcm:toast', onToast)
  }, [push])

  const value = useMemo(
    () => ({
      push,
      success: (message) => push({ type: 'success', message }),
      error: (message) => push({ type: 'error', message }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow ${
              toast.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
