"use client";

/**
 * ============================================================================
 *  mobileLayout — device-local (per-기기) 모바일/태블릿 배치 저장
 * ============================================================================
 *
 *  The desktop (lg) layout is the persisted source of truth in Supabase. md/sm
 *  are normally DERIVED from it (toFlowLayout) and never persisted, so a phone's
 *  reflow can't clobber the desktop arrangement.
 *
 *  When the user edits (drag/resize) on a phone/tablet, we DON'T touch the DB —
 *  we store that breakpoint's layout in localStorage, keyed by board + breakpoint.
 *  So each device keeps its own mobile arrangement, and the desktop layout stays
 *  exactly as it was (요구: 모바일에서 크기조절·이동 가능, 기기별 저장).
 *
 *  Shape: { [instanceId]: { x, y, w, h } } — absolute grid coords for that bp.
 *  Reads/writes are best-effort (try/catch): a quota error or private-mode
 *  failure just degrades to the derived layout, never throws into the canvas.
 * ============================================================================
 */

export interface StoredCell {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type StoredLayout = Record<string, StoredCell>;

/** localStorage key for a board's device-local layout at a breakpoint. */
function key(boardId: string, bp: string): string {
  return `pb:mlayout:${boardId}:${bp}`;
}

/** Read the stored device layout for a board+breakpoint (null when none/invalid). */
export function readMobileLayout(
  boardId: string,
  bp: string,
): StoredLayout | null {
  if (typeof window === "undefined" || !boardId) return null;
  try {
    const raw = window.localStorage.getItem(key(boardId, bp));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as StoredLayout;
  } catch {
    return null;
  }
}

/** Persist a board+breakpoint's layout to localStorage (best-effort). */
export function writeMobileLayout(
  boardId: string,
  bp: string,
  map: StoredLayout,
): void {
  if (typeof window === "undefined" || !boardId) return;
  try {
    window.localStorage.setItem(key(boardId, bp), JSON.stringify(map));
  } catch {
    /* quota / private mode — fall back to derived layout silently. */
  }
}
