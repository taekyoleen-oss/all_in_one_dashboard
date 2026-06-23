"use client";

/**
 * Persisted canvas lock (편집/잠금) — localStorage-backed via useSyncExternalStore so
 * the lock survives app restarts/reloads with NO setState-in-effect. The value is
 * the EDITABLE flag (true = 편집 가능/잠금 해제, false = 잠금): the Toolbar toggle and
 * GridCanvas both read it. Default = true (editable), matching the original
 * first-run behavior, so a fresh install starts unlocked.
 */

import * as React from "react";

export const LOCK_KEY = "pb:editable";

let listeners: Set<() => void> | null = null;

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Only an explicit "0" means locked; anything else (incl. absent) = editable.
    return window.localStorage.getItem(LOCK_KEY) !== "0";
  } catch {
    return true;
  }
}

function write(editable: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCK_KEY, editable ? "1" : "0");
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners?.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCK_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `[editable, setEditable]` — persisted across reloads. SSR snapshot = editable. */
export function usePersistedEditable(): readonly [boolean, (v: boolean) => void] {
  const editable = React.useSyncExternalStore(subscribe, read, () => true);
  const setEditable = React.useCallback((v: boolean) => write(v), []);
  return [editable, setEditable];
}
