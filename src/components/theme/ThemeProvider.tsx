"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "auto" | "light" | "dark";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean; // resolved
};

const ThemeCtx = createContext<Ctx | null>(null);

function resolveIsDark(theme: Theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  // auto -> match media
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}

/**
 * ThemeProvider: single source of truth for theme.
 * - Reads/writes localStorage("theme") as "auto" | "light" | "dark".
 * - Applies/removes .dark on <html>.
 * - Sets :root color-scheme for form controls.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("auto");
  const [isDark, setIsDark] = useState(false);

  // Load persisted theme (default auto)
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "auto";
    setTheme(saved);
    setIsDark(resolveIsDark(saved));
  }, []);

  // React to system changes when in auto
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setIsDark(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [theme]);

  // Apply html class & :root color-scheme
  useEffect(() => {
    const html = document.documentElement;
    const darkResolved = resolveIsDark(theme);
    setIsDark(darkResolved);

    // Class is used by Tailwind's dark: selector; we also toggle :root.dark for CSS vars
    html.classList.toggle("dark", darkResolved);
    html.classList.toggle("light", !darkResolved);

    // Keep a :root class variant for tokens
    if (darkResolved) {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.add("light");
      html.classList.remove("dark");
    }
  }, [theme]);

  const value = useMemo<Ctx>(
    () => ({
      theme,
      setTheme: (t) => {
        localStorage.setItem("theme", t);
        setTheme(t);
      },
      isDark,
    }),
    [theme, isDark]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
