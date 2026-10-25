"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: Theme; changeTheme: (theme: Theme) => void }>({ theme: "system", changeTheme: () => {} });
const validTheme = (value: string | null): Theme => value === "light" || value === "dark" ? value : "system";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setTheme(validTheme(localStorage.getItem("cowrie.theme"))); } catch {}
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === "cowrie.theme" || event.key === null) setTheme(validTheme(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, ready]);

  const changeTheme = (value: Theme) => {
    setTheme(value);
    try { localStorage.setItem("cowrie.theme", value); } catch {}
  };
  return <ThemeContext.Provider value={{ theme, changeTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeSwitch() {
  const { theme, changeTheme } = useTheme();
  return <div className="seg theme-switch" role="group" aria-label="Appearance">
    {(["light", "dark", "system"] as const).map((value) => <button type="button" key={value} className={theme === value ? "on" : ""} aria-pressed={theme === value} onClick={() => changeTheme(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
  </div>;
}
