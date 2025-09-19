"use client";

import { useTheme } from "./ThemeProvider";
import { Laptop, Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="inline-flex rounded-md border token-border token-card shadow-sm">
      <button
        className="btn focus-ring rounded-r-none border-0"
        aria-pressed={theme === "auto"}
        onClick={() => setTheme("auto")}
        title="System theme"
      >
        <Laptop className="h-4 w-4" />
      </button>
      <button
        className="btn focus-ring rounded-none border-x-0"
        aria-pressed={theme === "light"}
        onClick={() => setTheme("light")}
        title="Light"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        className="btn focus-ring rounded-l-none border-0"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
        title="Dark"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}
