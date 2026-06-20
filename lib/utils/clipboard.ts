"use client";

/**
 * ============================================================================
 *  App-internal widget clipboard (설계서 §3 위젯 메뉴 — 복사/붙여넣기)
 * ============================================================================
 *
 *  The widget menu's 복사/붙여넣기 does NOT use the OS clipboard (which can only
 *  hold text/blobs and would require permission prompts). Instead a single
 *  module-level slot holds the last-copied `{ type, config }` pair, shared across
 *  every widget menu via `useSyncExternalStore`. Paste reads this slot and the
 *  caller appends a fresh instance from it.
 *
 *  The stored `config` is structuredClone'd on copy so later edits to the source
 *  widget do not mutate what will be pasted (and vice-versa).
 * ============================================================================
 */

import { useSyncExternalStore } from "react";

/** What lives on the clipboard: enough to recreate a widget instance. */
export interface ClipboardPayload {
  type: string;
  config: unknown;
}

type Listener = () => void;

interface ClipboardStore {
  payload: ClipboardPayload | null;
  listeners: Set<Listener>;
}

const store: ClipboardStore = {
  payload: null,
  listeners: new Set(),
};

function emit() {
  for (const l of store.listeners) l();
}

/** Deep-clone the config so source/paste do not share a mutable reference. */
function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    // Fallback for non-structured-cloneable configs (functions, etc.).
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

/** Copy a widget's `{ type, config }` onto the app clipboard. */
export function copyToClipboard(payload: ClipboardPayload): void {
  store.payload = { type: payload.type, config: clone(payload.config) };
  emit();
}

/** Read (and clone) the current clipboard payload, or null if empty. */
export function readClipboard(): ClipboardPayload | null {
  if (!store.payload) return null;
  return { type: store.payload.type, config: clone(store.payload.config) };
}

function subscribe(listener: Listener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot(): ClipboardPayload | null {
  return store.payload;
}

function getServerSnapshot(): ClipboardPayload | null {
  return null;
}

export interface UseClipboardResult {
  /** Current payload (null when nothing copied yet). Read-only snapshot. */
  payload: ClipboardPayload | null;
  /** True when there is something to paste. */
  hasContent: boolean;
  /** Copy `{ type, config }` onto the clipboard. */
  copy: (payload: ClipboardPayload) => void;
  /** Read + clone the current payload (null when empty). */
  read: () => ClipboardPayload | null;
}

/**
 * Subscribe to the shared widget clipboard. Components re-render when the
 * clipboard changes, so a freshly-copied widget instantly enables 붙여넣기
 * in every open menu.
 */
export function useClipboard(): UseClipboardResult {
  const payload = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    payload,
    hasContent: payload != null,
    copy: copyToClipboard,
    read: readClipboard,
  };
}
