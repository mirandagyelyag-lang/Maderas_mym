import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();
const THEMES = ["light", "dark", "comfort"];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem("velvet-theme");
    return THEMES.includes(saved) ? saved : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("velvet-theme", theme);
  }, [theme]);

  function setTheme(nextTheme) {
    if (THEMES.includes(nextTheme)) setThemeState(nextTheme);
  }

  function toggleTheme() {
    setThemeState((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe utilizarse dentro de ThemeProvider");
  return context;
}
