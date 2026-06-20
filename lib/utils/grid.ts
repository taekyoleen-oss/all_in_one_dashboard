"use client";

/**
 * ============================================================================
 *  Grid helpers — instance creation + placement (설계서 §3 팔레트, §6.1 캔버스)
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

/** Number of columns at the desktop (lg) breakpoint — mirrors GridCanvas COLS.lg. */
export const LG_COLS = 12;

/** Mint a reasonably-unique instance id (local-only; DB will assign real uuids). */
export function newInstanceId(type: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${type}-${rand}`;
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
