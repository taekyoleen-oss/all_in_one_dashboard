"use client";

/**
 * Persisted theme (dark/light) — localStorage-backed via useSyncExternalStore so
 * the choice survives reloads with NO setState-in-effect. The actual `data-theme`
 * attribute is set early (no flash) by an inline script in app/layout.tsx that
 * reads the SAME key; this hook keeps React + localStorage + the attribute in sync
 * for the toggle. Default = dark (matches the token base on :root).
 */

import * as React from "react";

export const THEME_KEY = "pb:theme";
export type ThemeMode = "dark" | "light";

let listeners: Set<() => void> | null = null;

function read(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function write(value: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, value);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  // Apply immediately so the toggle is instant (tokens key off :root[data-theme]).
  document.documentElement.setAttribute("data-theme", value);
  listeners?.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersistedTheme(): readonly [ThemeMode, (v: ThemeMode) => void] {
  const theme = React.useSyncExternalStore(
    subscribe,
    read,
    (): ThemeMode => "dark",
  );
  const setTheme = React.useCallback((v: ThemeMode) => write(v), []);
  return [theme, setTheme];
}
