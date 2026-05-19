import { createContext, useContext, useState, type ReactNode } from "react"

export type Theme = "dark" | "light"

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("stageone-theme") as Theme | null
      return stored === "light" ? "light" : "dark"
    } catch {
      return "dark"
    }
  })

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark"
      try { localStorage.setItem("stageone-theme", next) } catch {}
      return next
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}

export function ThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {children}
    </div>
  )
}
