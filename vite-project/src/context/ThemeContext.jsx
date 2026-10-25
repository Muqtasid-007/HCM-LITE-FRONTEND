import { createContext, useContext, useMemo } from 'react'

const ThemeContext = createContext({ name: 'hcm-lite' })

export function ThemeProvider({ children }) {
  const value = useMemo(() => ({ name: 'hcm-lite', primary: 'emerald' }), [])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
