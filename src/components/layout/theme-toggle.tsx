"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const APP_THEME_STORAGE_KEY = "graph-pixel-theme";
const EDITOR_THEME_STORAGE_KEY = "graph-pixel-editor-theme";
const THEME_COLORS = {
  dark: "#111319",
  light: "#f4f3ef",
} as const;

type ThemeMode = keyof typeof THEME_COLORS;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function applyAppTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

function applyEditorTheme(theme: ThemeMode) {
  document.documentElement.dataset.editorTheme = theme;
}

function readStoredTheme(storageKey: string, fallback: ThemeMode, legacyStorageKey?: string): ThemeMode {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isThemeMode(stored)) return stored;
    if (legacyStorageKey) {
      const legacyStored = window.localStorage.getItem(legacyStorageKey);
      if (isThemeMode(legacyStored)) return legacyStored;
    }
  } catch {
    // Storage can be unavailable in restricted browsing modes.
  }
  return fallback;
}

export function ThemeToggle({ variant = "rail" }: { variant?: "rail" | "mobile" | "editor" }) {
  const isEditorTheme = variant === "editor";
  const storageKey = isEditorTheme ? EDITOR_THEME_STORAGE_KEY : APP_THEME_STORAGE_KEY;
  const fallbackTheme: ThemeMode = isEditorTheme ? "dark" : "light";
  const [theme, setTheme] = useState<ThemeMode>(fallbackTheme);

  useEffect(() => {
    const storedTheme = readStoredTheme(
      storageKey,
      fallbackTheme,
      isEditorTheme ? APP_THEME_STORAGE_KEY : undefined,
    );
    setTheme(storedTheme);
    if (isEditorTheme) applyEditorTheme(storedTheme);
    else applyAppTheme(storedTheme);
  }, [fallbackTheme, isEditorTheme, storageKey]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (isEditorTheme) applyEditorTheme(nextTheme);
    else applyAppTheme(nextTheme);
    try {
      window.localStorage.setItem(storageKey, nextTheme);
    } catch {
      // Storage can be unavailable in restricted browsing modes.
    }
  }

  const contextLabel = isEditorTheme ? "editor" : "app";
  const nextLabel = theme === "dark" ? `Switch ${contextLabel} to light mode` : `Switch ${contextLabel} to dark mode`;
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${variant}`}
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      data-theme-value={theme}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <Sun className="theme-toggle__sun" size={12} strokeWidth={2.2} />
        <Moon className="theme-toggle__moon" size={12} strokeWidth={2.2} />
        <span className="theme-toggle__thumb">
          <Icon size={11} strokeWidth={2.4} />
        </span>
      </span>
      {variant === "mobile" ? <span className="theme-toggle__label">{theme === "dark" ? "Light" : "Dark"}</span> : null}
    </button>
  );
}
