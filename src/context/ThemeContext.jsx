import { createContext, useContext, useEffect, useState } from 'react'
const ThemeContext = createContext(null)
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('pc-theme')
    // Only honour an explicit user choice — never follow OS preference.
    // PostCommand is a dark-first app (deep black + NPS gold).
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('pc-theme', theme)
  }, [theme])
  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
