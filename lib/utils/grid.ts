/**
 * ============================================================================
 *  Grid helpers — instance creation + placement (설계서 §3 팔레트, §6.1 캔버스)
 *
 *  Universal (server + client): pure functions over the registry data — used by
 *  client components (WidgetPalette/FocusOverlay) AND the server first-login
 *  bootstrap (lib/supabase/queries/boards.ts). No "use client": these never touch
 *  React/DOM, only `crypto`/`structuredClone` (both exist in Node 22 + browsers).
 * ============================================================================
 *
 *  Shared by WidgetPalette (drag/tap add) and FocusOverlay/menu (복사·붙여넣기
 *  duplicate). Keeps the page/components free of id-minting and "where does the
 *  new tile go" bookkeeping.
 * ============================================================================
 */

import type { WidgetRegistry } from "@/lib/widgets/contract";
import type {
  WidgetInstance,
  CanvasLayoutItem,
} from "@/components/canvas/GridCanvas";

/** Number of columns at the desktop (lg) breakpoint — mirrors GridCanvas COLS.lg.
 *  v2 grid = 24 cols (finer placement/resize). */
export const LG_COLS = 24;

/**
 * Mint a real UUID for a widget instance. `pb_widgets.id` is a `uuid` column and
 * the client supplies the id on insert (DB id === instanceId from the first
 * write), so a `${type}-xxxx` string is rejected by Postgres with `22P02`. The
 * type is no longer encoded in the id (it was only cosmetic).
 */
export function newInstanceId(_type?: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Defensive fallback for environments without crypto.randomUUID (RFC4122 v4).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Find the lowest free row so a freshly added tile lands BELOW existing content
 * (verticalCompactor then tucks it up into any gaps). Width/height come from the
 * widget's defaultSize.
 */
export function placeBelow(
  layout: CanvasLayoutItem[],
  size: { w: number; h: number },
  cols = LG_COLS,
): { x: number; y: number; w: number; h: number } {
  const w = Math.min(size.w, cols);
  const maxBottom = layout.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  return { x: 0, y: maxBottom, w, h: size.h };
}

/**
 * Create a new `{ instance, layoutItem }` pair for `type` from the registry,
 * optionally overriding the config (used by 붙여넣기) and the grid placement
 * (used by drag-drop, which already has an x/y from RGL).
 */
export function createInstance(
  registry: WidgetRegistry,
  type: string,
  opts?: {
    config?: unknown;
    placement?: { x: number; y: number; w?: number; h?: number };
    existingLayout?: CanvasLayoutItem[];
  },
): { instance: WidgetInstance; layoutItem: CanvasLayoutItem } | null {
  const def = registry[type];
  if (!def) return null;

  const instanceId = newInstanceId(type);
  const config =
    opts?.config !== undefined
      ? opts.config
      : // Fresh copy of defaultConfig so instances never share a reference.
        structuredCloneSafe(def.defaultConfig);

  const place =
    opts?.placement ??
    placeBelow(opts?.existingLayout ?? [], def.defaultSize);

  const layoutItem: CanvasLayoutItem = {
    instanceId,
    x: place.x,
    y: place.y,
    w: place.w ?? def.defaultSize.w,
    h: place.h ?? def.defaultSize.h,
  };

  return { instance: { instanceId, type, config }, layoutItem };
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
