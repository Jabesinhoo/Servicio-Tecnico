import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

function getInitialTheme() {
  // 1. Verificar localStorage
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  
  // 2. Verificar preferencia del sistema
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  
  // 3. Por defecto
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = window.document.documentElement;
    
    // Remover clases anteriores
    root.classList.remove("light", "dark");
    
    // Agregar nueva clase
    root.classList.add(theme);
    
    // Guardar en localStorage
    localStorage.setItem("theme", theme);
    
  }, [theme, mounted]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        setTheme((t) => (t === "dark" ? "light" : "dark"));
      },
      setTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}