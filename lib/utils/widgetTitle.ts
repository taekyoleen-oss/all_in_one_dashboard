"use client";

/**
 * Per-widget custom title — a localStorage-backed override of the widget's
 * display name (요구: 제목 더블클릭 변경). Stored per instanceId (per device), same
 * pattern as usePersistedFontScale / usePersistedColor, so renaming never risks a
 * config round-trip (a widget's ConfigEditor replacing config can't drop it).
 */

import * as React from "react";

const PREFIX = "pb:title:";
const keyOf = (id: string) => PREFIX + id;
const listeners = new Map<string, Set<() => void>>();

function read(id: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyOf(id));
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

function write(id: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value || !value.trim()) window.localStorage.removeItem(keyOf(id));
    else window.localStorage.setItem(keyOf(id), value.trim());
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners.get(id)?.forEach((l) => l());
}

function subscribe(id: string, cb: () => void): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === keyOf(id)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(id);
    window.removeEventListener("storage", onStorage);
  };
}

export interface TitleControls {
  /** Custom title, or null when none set (caller falls back to displayName). */
  title: string | null;
  setTitle: (value: string | null) => void;
}

export function usePersistedTitle(instanceId: string): TitleControls {
  const sub = React.useCallback(
    (cb: () => void) => subscribe(instanceId, cb),
    [instanceId],
  );
  const title = React.useSyncExternalStore(
    sub,
    React.useCallback(() => read(instanceId), [instanceId]),
    () => null,
  );
  const setTitle = React.useCallback(
    (value: string | null) => write(instanceId, value),
    [instanceId],
  );
  return { title, setTitle };
}
