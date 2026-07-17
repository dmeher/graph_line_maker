"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "graph-pixel-theme";
const THEME_COLORS = {
  dark: "#0b1017",
  light: "#f5f7fa",
} as const;

type ThemeMode = keyof typeof THEME_COLORS;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // Storage can be unavailable in restricted browsing modes.
  }
  return "dark";
}

export function ThemeToggle({ variant = "rail" }: { variant?: "rail" | "mobile" | "editor" }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const storedTheme = readStoredTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }
  }

  const nextLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${variant}`}
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <Icon size={variant === "mobile" ? 15 : 17} strokeWidth={2} aria-hidden="true" />
      {variant === "mobile" ? <span>{theme === "dark" ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
