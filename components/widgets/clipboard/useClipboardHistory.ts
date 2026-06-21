"use client";

/**
 * useClipboardHistory — per-instance clipboard history backed by localStorage.
 *
 *  WHY localStorage (not pb_widgets.config): clipboard entries are device-local
 *  and change frequently (every copy). Storing them in `config` would round-trip
 *  through Supabase on every capture. Same pattern as usePersistedFontScale —
 *  useSyncExternalStore keeps React + localStorage in sync with no
 *  setState-in-effect, keyed per instanceId so two clipboard widgets stay
 *  independent. A `copy`-capture helper is included for the views to share.
 */

import * as React from "react";
import { clampMaxItems, type ClipItem } from "./types";

const PREFIX = "pb:clipboard:";
const EMPTY: ClipItem[] = [];

const keyOf = (id: string) => PREFIX + id;
const listeners = new Map<string, Set<() => void>>();
// raw-string → parsed cache so getSnapshot returns a STABLE reference when the
// stored value is unchanged (required by useSyncExternalStore).
const cache = new Map<string, { raw: string | null; parsed: ClipItem[] }>();

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

function readRaw(id: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyOf(id));
  } catch {
    return null;
  }
}

function readItems(id: string): ClipItem[] {
  const raw = readRaw(id);
  const cached = cache.get(id);
  if (cached && cached.raw === raw) return cached.parsed;
  let parsed: ClipItem[] = [];
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        parsed = arr.filter(
          (x): x is ClipItem =>
            !!x &&
            typeof (x as ClipItem).text === "string" &&
            typeof (x as ClipItem).id === "string",
        );
      }
    } catch {
      /* corrupt → empty */
    }
  }
  cache.set(id, { raw, parsed });
  return parsed;
}

function writeItems(id: string, items: ClipItem[]): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(items);
  try {
    window.localStorage.setItem(keyOf(id), raw);
  } catch {
    /* quota / privacy-mode — keep in-memory cache anyway */
  }
  cache.set(id, { raw, parsed: items });
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
    if (e.key === keyOf(id)) {
      cache.delete(id); // force re-parse from the new cross-tab value
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(id);
    window.removeEventListener("storage", onStorage);
  };
}

export interface ClipboardHistory {
  items: ClipItem[];
  /** Add text to the top (dedupes; trims; caps to maxItems). No-op if blank. */
  add: (text: string) => void;
  /** Remove one entry by id. */
  remove: (id: string) => void;
  /** Clear all entries. */
  clear: () => void;
}

export function useClipboardHistory(
  instanceId: string,
  maxItems: number,
): ClipboardHistory {
  const sub = React.useCallback(
    (cb: () => void) => subscribe(instanceId, cb),
    [instanceId],
  );
  const items = React.useSyncExternalStore(
    sub,
    React.useCallback(() => readItems(instanceId), [instanceId]),
    () => EMPTY,
  );

  const cap = clampMaxItems(maxItems);

  const add = React.useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      const cur = readItems(instanceId);
      // Move an existing identical entry to the top instead of duplicating.
      const deduped = cur.filter((i) => i.text !== t);
      const next = [{ id: newId(), text: t, ts: Date.now() }, ...deduped].slice(
        0,
        cap,
      );
      writeItems(instanceId, next);
    },
    [instanceId, cap],
  );

  const remove = React.useCallback(
    (id: string) =>
      writeItems(
        instanceId,
        readItems(instanceId).filter((i) => i.id !== id),
      ),
    [instanceId],
  );

  const clear = React.useCallback(
    () => writeItems(instanceId, []),
    [instanceId],
  );

  return { items, add, remove, clear };
}

/**
 * Capture text copied ON the page (the `copy` event). Reads the current
 * selection, falling back to the selected range of a focused input/textarea.
 * Shared by Compact + Expanded views; the history's add() dedupes overlaps.
 */
export function useCopyCapture(
  enabled: boolean,
  onText: (text: string) => void,
): void {
  const ref = React.useRef(onText);
  ref.current = onText;
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const handler = () => {
      let text = "";
      try {
        text = window.getSelection()?.toString() ?? "";
      } catch {
        /* ignore */
      }
      if (!text) {
        const el = document.activeElement;
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          const s = el.selectionStart ?? 0;
          const e = el.selectionEnd ?? 0;
          if (e > s) text = el.value.slice(s, e);
        }
      }
      if (text && text.trim()) ref.current(text);
    };
    document.addEventListener("copy", handler);
    return () => document.removeEventListener("copy", handler);
  }, [enabled]);
}

/** Re-copy helper: writes text to the OS clipboard, returns success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Read the current OS clipboard text (requires a user gesture + permission). */
export async function readClipboardText(): Promise<string | null> {
  try {
    const t = await navigator.clipboard.readText();
    return t && t.trim() ? t : null;
  } catch {
    return null;
  }
}
