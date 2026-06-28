"use client";

/**
 * Persisted "행 높이 맞춤" toggle for 자동정렬 — localStorage-backed via
 * useSyncExternalStore (no setState-in-effect, survives reloads). When ON, the
 * auto-arrange equalizes every widget's height within a row to that row's tallest.
 * Default = OFF (heights preserved). Per device (localStorage), like the lock/theme.
 */

import * as React from "react";

export const ARRANGE_BASELINE_KEY = "pb:arrange-baseline";

let listeners: Set<() => void> | null = null;

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ARRANGE_BASELINE_KEY) === "1";
  } catch {
    return false;
  }
}

function write(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARRANGE_BASELINE_KEY, on ? "1" : "0");
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners?.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === ARRANGE_BASELINE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `[equalizeHeights, setEqualizeHeights]` — persisted across reloads. SSR = false. */
export function usePersistedArrangeBaseline(): readonly [
  boolean,
  (v: boolean) => void,
] {
  const on = React.useSyncExternalStore(subscribe, read, () => false);
  const setOn = React.useCallback((v: boolean) => write(v), []);
  return [on, setOn];
}
