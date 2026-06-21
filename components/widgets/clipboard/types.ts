/**
 * clipboard widget — config shape (클립보드 기록).
 *
 *  Records text copied while this page is open and lets you re-copy any entry
 *  with one click. dataMode:'static' (local). copyBehavior:'custom' (clicking an
 *  entry copies it).
 *
 *  ⚠ Browser limitation: a web app CANNOT silently watch the OS (Windows)
 *  clipboard in the background. We capture copies made ON the page (the `copy`
 *  event) automatically, and provide a "클립보드에서 추가" button that reads the
 *  current OS clipboard on demand (navigator.clipboard.readText, requires a user
 *  gesture + permission). The history itself lives in localStorage per instance
 *  (device-local — clipboard data is inherently device-specific), not in the DB.
 */

export interface ClipboardConfig {
  /** Max number of entries to keep (older ones are dropped). */
  maxItems: number;
  /** Auto-capture text copied on this page (the `copy` event). */
  captureOnCopy: boolean;
}

export const DEFAULT_CLIPBOARD_CONFIG: ClipboardConfig = {
  maxItems: 30,
  captureOnCopy: true,
};

/** One recorded clipboard entry (stored in localStorage, keyed by instanceId). */
export interface ClipItem {
  id: string;
  text: string;
  /** Epoch ms when captured. */
  ts: number;
}

/** Clamp maxItems to a sane range. */
export function clampMaxItems(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CLIPBOARD_CONFIG.maxItems;
  return Math.min(200, Math.max(5, Math.round(n)));
}
