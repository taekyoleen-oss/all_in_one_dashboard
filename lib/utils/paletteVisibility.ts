"use client";

/**
 * paletteVisibility — which widget types are HIDDEN from the palette.
 *
 *  A per-device preference (localStorage, like theme + palette collapse) so the
 *  user can keep only the apps they actually use in the palette. We store the
 *  HIDDEN set (not the shown set) so any NEW widget type added in a future update
 *  appears by default unless explicitly hidden.
 *
 *  Backed by useSyncExternalStore (same pattern as usePaletteCollapsed) — reads
 *  the persisted value on the client with no setState-in-effect, SSR-safely
 *  renders the default (nothing hidden), and a module-level listener set notifies
 *  all subscribers (and `storage` events sync across tabs). Hiding from the
 *  palette never affects already-placed instances — GridCanvas/FocusOverlay use
 *  the full registry to render existing widgets.
 */

import * as React from "react";

const KEY = "pb:hidden-widgets";

let listeners: Set<() => void> | null = null;
let cache: Set<string> | null = null;
/** Stable empty snapshot for SSR / initial hydration. */
const EMPTY: ReadonlySet<string> = new Set();

function read(): ReadonlySet<string> {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = new Set();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    cache = new Set(
      Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    cache = new Set();
  }
  return cache;
}

function write(next: ReadonlySet<string>): void {
  cache = new Set(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      /* ignore quota / privacy-mode */
    }
  }
  listeners?.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (!listeners) listeners = new Set();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null; // invalidate so the next read re-parses
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface HiddenWidgetsApi {
  /** The set of hidden widget type keys. */
  hidden: ReadonlySet<string>;
  /** Show (visible=true) or hide (visible=false) a widget type in the palette. */
  setVisible: (type: string, visible: boolean) => void;
  /** Replace the whole hidden set (e.g. 모두 표시 / 모두 숨기기). */
  setHidden: (next: ReadonlySet<string>) => void;
}

export function useHiddenWidgets(): HiddenWidgetsApi {
  const hidden = React.useSyncExternalStore(subscribe, read, () => EMPTY);
  const setVisible = React.useCallback((type: string, visible: boolean) => {
    const next = new Set(read());
    if (visible) next.delete(type);
    else next.add(type);
    write(next);
  }, []);
  const setHidden = React.useCallback((next: ReadonlySet<string>) => write(next), []);
  return { hidden, setVisible, setHidden };
}
