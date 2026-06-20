"use client";

/**
 * Per-widget font scale — a localStorage-backed zoom factor applied to each
 * widget tile's content (설계서 §3 위젯 메뉴 "글자 크기").
 *
 *  WHY localStorage (not pb_widgets.config): the scale is a pure per-device UI
 *  preference, not domain data. Storing it in `config` would pollute every
 *  widget's (often strict) Zod schema and round-trip through the DB for a
 *  cosmetic toggle. Same pattern as the theme + palette-position prefs.
 *
 *  WHY zoom (applied by the caller): widget internals use fixed Tailwind text
 *  sizes (rem), so a parent `font-size` would NOT cascade into them. CSS `zoom`
 *  scales the whole subtree (text + spacing) uniformly and works across all 15
 *  widgets without rewriting any of them.
 *
 *  useSyncExternalStore keeps React + localStorage in sync with NO
 *  setState-in-effect (React 19 strict). Keyed per instanceId, so two tiles of
 *  the same type scale independently, and the ⋮-menu control + the tile stay in
 *  lockstep (both subscribe to the same key).
 */

import * as React from "react";

const PREFIX = "pb:fontscale:";
export const MIN_SCALE = 0.7;
export const MAX_SCALE = 1.8;
export const STEP = 0.1;
const DEFAULT_SCALE = 1;

const keyOf = (id: string) => PREFIX + id;
const listeners = new Map<string, Set<() => void>>();

/** Round to a clean 0.1 step and clamp to [MIN, MAX]. */
function clampScale(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SCALE;
  const stepped = Math.round(n * 10) / 10;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, stepped));
}

function read(id: string): number {
  if (typeof window === "undefined") return DEFAULT_SCALE;
  try {
    const raw = window.localStorage.getItem(keyOf(id));
    if (raw == null) return DEFAULT_SCALE;
    return clampScale(parseFloat(raw));
  } catch {
    return DEFAULT_SCALE;
  }
}

function write(id: string, value: number): void {
  if (typeof window === "undefined") return;
  const v = clampScale(value);
  try {
    if (v === DEFAULT_SCALE) window.localStorage.removeItem(keyOf(id));
    else window.localStorage.setItem(keyOf(id), String(v));
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

export interface FontScaleControls {
  /** Current scale (1 = 기본). */
  scale: number;
  /** Increase by one step (clamped). */
  inc: () => void;
  /** Decrease by one step (clamped). */
  dec: () => void;
  /** Reset to the default (1 = 100%). */
  reset: () => void;
}

/**
 * Subscribe to (and mutate) the font scale for a single widget instance.
 * Returns the live `scale` plus inc/dec/reset helpers.
 */
export function usePersistedFontScale(instanceId: string): FontScaleControls {
  const sub = React.useCallback(
    (cb: () => void) => subscribe(instanceId, cb),
    [instanceId],
  );
  const snap = React.useCallback(() => read(instanceId), [instanceId]);
  const scale = React.useSyncExternalStore(sub, snap, () => DEFAULT_SCALE);

  const inc = React.useCallback(
    () => write(instanceId, read(instanceId) + STEP),
    [instanceId],
  );
  const dec = React.useCallback(
    () => write(instanceId, read(instanceId) - STEP),
    [instanceId],
  );
  const reset = React.useCallback(
    () => write(instanceId, DEFAULT_SCALE),
    [instanceId],
  );

  return { scale, inc, dec, reset };
}
