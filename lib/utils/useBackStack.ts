"use client";

/**
 * ============================================================================
 *  Back-Stack Guard — 포커스/시트 뒤로가기 제어 (설계서 §6.3 ★요청 핵심★)
 * ============================================================================
 *
 *  Requirement: while an overlay (focus view / palette sheet / config dialog) is
 *  open, pressing **Back** must close exactly ONE overlay level and KEEP the app
 *  open. The app only leaves from the base canvas (empty stack).
 *
 *  Mechanism (per §6.3):
 *    • openOverlay(id) → history.pushState({ pbOverlay: id }) and push id (LIFO).
 *    • popstate        → if overlays open: pop the TOP one and STOP (the browser
 *                        already consumed one history entry, so we do NOT exit).
 *                        if none open: do nothing → the base entry navigates
 *                        normally (app/route exit allowed).
 *    • closeTop()      → history.back(); the resulting popstate pops the top.
 *                        Single pop path ⇒ no double-close, history stays tidy.
 *
 *  Why this satisfies the success criteria:
 *    - Focus/Sheet back ⇒ exactly one level closes, app stays (we pushed a real
 *      history entry per overlay, and popstate only unwinds our own stack).
 *    - Base back ⇒ normal exit (stack empty ⇒ handler is a no-op ⇒ browser does
 *      its default navigation).
 *    - LIFO multi-level: nested overlays each push one entry; each back closes
 *      the most recent. Closing via the X button routes through history.back()
 *      so it behaves identically to a hardware/gesture back.
 *    - PWA / Android gesture back fire the SAME `popstate` event, so the guard
 *      works without any platform-specific code.
 *
 *  Implementation: a single module-level store + ONE window `popstate` listener,
 *  shared via `useSyncExternalStore`. This guarantees a focus overlay and a
 *  sheet (different components) cooperate on one ordered stack instead of each
 *  installing competing listeners.
 * ============================================================================
 */

import { useCallback, useSyncExternalStore } from "react";

/** A marker placed on the history state we push, so we can recognize our entries. */
const OVERLAY_STATE_KEY = "pbOverlay" as const;

type Listener = () => void;

interface BackStackStore {
  stack: string[];
  listeners: Set<Listener>;
  installed: boolean;
}

const store: BackStackStore = {
  stack: [],
  listeners: new Set(),
  installed: false,
};

function emit() {
  for (const l of store.listeners) l();
}

/** Pop the top overlay (state mutation only — does not touch history). */
function popTopInternal() {
  if (store.stack.length === 0) return;
  store.stack = store.stack.slice(0, -1);
  emit();
}

/**
 * The single popstate handler. The browser has already rewound one history
 * entry by the time this fires. If we have overlays open, we treat that as
 * "close the top overlay" and stop there — the app does not exit. If the stack
 * is empty, we leave the navigation alone (base → normal exit).
 */
function handlePopState() {
  if (store.stack.length > 0) {
    popTopInternal();
  }
  // else: base state — allow default browser navigation (app/route exit).
}

function ensureInstalled() {
  if (store.installed || typeof window === "undefined") return;
  window.addEventListener("popstate", handlePopState);
  store.installed = true;
}

/** Open an overlay: push a real history entry, then record it on the stack. */
function openOverlayInternal(id: string) {
  if (typeof window === "undefined") return;
  ensureInstalled();
  // One history entry per overlay so that one Back == one close.
  window.history.pushState({ [OVERLAY_STATE_KEY]: id }, "");
  store.stack = [...store.stack, id];
  emit();
}

/**
 * Close the top overlay via the same path a hardware back would take:
 * history.back() triggers popstate → handlePopState → popTopInternal.
 * Routing all closes through history keeps the entry count correct.
 */
function closeTopInternal() {
  if (typeof window === "undefined") return;
  if (store.stack.length === 0) return;
  window.history.back();
}

function subscribe(listener: Listener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot(): string[] {
  return store.stack;
}

// Server snapshot: the stack is always empty during SSR (no history there).
const EMPTY: string[] = [];
function getServerSnapshot(): string[] {
  return EMPTY;
}

export interface UseBackStackResult {
  /** Current LIFO overlay stack (bottom → top). Read-only snapshot. */
  stack: readonly string[];
  /** The id of the top-most open overlay, or null at base. */
  top: string | null;
  /** Number of open overlays. */
  depth: number;
  /** Open an overlay; pushes a history entry so Back closes exactly this one. */
  openOverlay: (id: string) => void;
  /** Close the top overlay (equivalent to a single Back). */
  closeTop: () => void;
  /** True iff `id` is currently the top overlay (handy for visibility). */
  isTop: (id: string) => boolean;
  /** True iff `id` is anywhere in the stack. */
  isOpen: (id: string) => boolean;
}

/**
 * Hook into the shared Back-Stack Guard.
 *
 * Usage:
 * ```tsx
 * const { openOverlay, closeTop, isOpen } = useBackStack();
 * // open a focus overlay:
 * openOverlay(`focus:${instanceId}`);
 * // its close button:
 * <button onClick={closeTop}>닫기</button>
 * // render gate:
 * {isOpen(`focus:${instanceId}`) && <FocusOverlay … />}
 * ```
 */
export function useBackStack(): UseBackStackResult {
  const stack = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const openOverlay = useCallback((id: string) => openOverlayInternal(id), []);
  const closeTop = useCallback(() => closeTopInternal(), []);
  const isTop = useCallback(
    (id: string) => stack.length > 0 && stack[stack.length - 1] === id,
    [stack],
  );
  const isOpen = useCallback((id: string) => stack.includes(id), [stack]);

  return {
    stack,
    top: stack.length > 0 ? stack[stack.length - 1] : null,
    depth: stack.length,
    openOverlay,
    closeTop,
    isTop,
    isOpen,
  };
}
