"use client";

/**
 * Per-widget tile color — a localStorage-backed pastel tint applied to each
 * widget's frame (요구: 앱 색 지정, 파스텔 10색). Same rationale/pattern as
 * usePersistedFontScale: a per-DEVICE cosmetic preference, not domain data, so it
 * lives in localStorage (keyed per instanceId) rather than the DB config.
 *
 * The chosen color is blended ~25% over --card via color-mix at the call site, so
 * the tint stays subtle and TEXT remains readable in both light and dark themes.
 */

import * as React from "react";

const PREFIX = "pb:color:";
const keyOf = (id: string) => PREFIX + id;
const listeners = new Map<string, Set<() => void>>();

/** 10 soft pastels + a "기본"(none) option. `value` is the base hex to blend. */
export interface PastelOption {
  name: string;
  /** null = 기본(테마 카드색). */
  value: string | null;
}
export const PASTEL_COLORS: PastelOption[] = [
  { name: "기본", value: null },
  { name: "로즈", value: "#F8C8D8" },
  { name: "코랄", value: "#FAD2C0" },
  { name: "피치", value: "#FBE0C4" },
  { name: "레몬", value: "#FBEFB6" },
  { name: "라임", value: "#DCEFBE" },
  { name: "민트", value: "#C5EBD8" },
  { name: "스카이", value: "#C4E5F5" },
  { name: "블루", value: "#CBD8F7" },
  { name: "라벤더", value: "#DDD0F5" },
  { name: "그레이", value: "#DEE4EC" },
];

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
    if (!value) window.localStorage.removeItem(keyOf(id));
    else window.localStorage.setItem(keyOf(id), value);
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

export interface ColorControls {
  /** Current base hex, or null for 기본. */
  color: string | null;
  /** Set (or clear with null) the tile color. */
  setColor: (value: string | null) => void;
}

export function usePersistedColor(instanceId: string): ColorControls {
  const sub = React.useCallback(
    (cb: () => void) => subscribe(instanceId, cb),
    [instanceId],
  );
  const color = React.useSyncExternalStore(
    sub,
    React.useCallback(() => read(instanceId), [instanceId]),
    () => null,
  );
  const setColor = React.useCallback(
    (value: string | null) => write(instanceId, value),
    [instanceId],
  );
  return { color, setColor };
}

/** CSS background that blends the pastel ~25% over the theme card color. */
export function tintBackground(color: string | null): string | undefined {
  if (!color) return undefined;
  return `color-mix(in srgb, ${color} 30%, var(--card))`;
}
