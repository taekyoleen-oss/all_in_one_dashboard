"use client";

/**
 * Persisted "가로 채우기"(justify) toggle for 자동정렬 — localStorage-backed via
 * useSyncExternalStore (no setState-in-effect, survives reloads). When ON, the
 * auto-arrange WIDENS widgets to fill each row up to their maxW (크기 변경). When
 * OFF (default) widths are preserved and gaps are filled only by moving widgets
 * (masonry). Per device (localStorage), like the lock/theme/baseline toggles.
 */

import * as React from "react";

export const ARRANGE_JUSTIFY_KEY = "pb:arrange-justify";

let listeners: Set<() => void> | null = null;

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ARRANGE_JUSTIFY_KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARRANGE_JUSTIFY_KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners?.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ARRANGE_JUSTIFY_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `[justify, setJustify]` — persisted across reloads. SSR = false (크기 유지). */
export function usePersistedArrangeJustify(): readonly [
  boolean,
  (v: boolean) => void,
] {
  const on = React.useSyncExternalStore(subscribe, read, () => false);
  const setOn = React.useCallback((v: boolean) => write(v), []);
  return [on, setOn];
}
