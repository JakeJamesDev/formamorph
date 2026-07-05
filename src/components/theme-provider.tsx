import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

interface ThemeProviderState {
  theme: Theme
  /** The effective theme actually applied to `<html>` — `system` resolved to `light`/`dark`. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

/** Applies the selected theme to `<html>` (adds `light`/`dark`, resolving `"system"` via the
 *  `prefers-color-scheme` media query) and persists the choice to `localStorage` under `storageKey`. */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme
  )

  useEffect(() => {
    const root = window.document.documentElement
    const apply = (resolved: ResolvedTheme) => {
      root.classList.remove("light", "dark")
      root.classList.add(resolved)
      setResolvedTheme(resolved)
    }

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)")
      apply(mql.matches ? "dark" : "light")
      // Follow the OS while in system mode so the app + toasts update live.
      const onChange = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light")
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    }

    apply(theme)
  }, [theme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

/** Reads the current theme and setter from `ThemeProviderContext`; throws if used outside a `ThemeProvider`. */
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
