/**
 * ============================================================================
 *  Persistence types + DB↔UI mapping (설계서 §5.1/§5.2/§5.4)
 * ============================================================================
 *
 *  Shared by the SERVER loader (lib/supabase/queries/boards.ts) and the CLIENT
 *  persistence hook (lib/persistence/usePersistence.ts). This module is the one
 *  place that knows how a `pb_dashboards` row maps to a board and how a
 *  `pb_widgets` row maps to a placed widget instance + its desktop (lg) layout.
 *
 *  ── Mapping ────────────────────────────────────────────────────────────────
 *  pb_dashboards row  ↔  BoardState.meta   (id, name, isDefault, sortOrder)
 *  pb_widgets   row  ↔  { instance, layoutItem }
 *      .id      → instance.instanceId  (uuid is the stable instance id)
 *      .type    → instance.type        (registry key)
 *      .config  → instance.config      (the widget's own `C`, jsonb)
 *      .layout  → { x,y,w,h, minW,minH,maxW,maxH } for the lg breakpoint.
 *                 Only x/y/w/h are authoritative for the UI (min/max are derived
 *                 from the registry at render time); we persist min/max too so
 *                 the column self-documents (§5.2) and survives registry edits.
 *
 *  §5.4: ONLY the desktop (lg) layout is stored — mobile (sm) is auto-derived as
 *  a 1-col stack and never written. Mutations are optimistic + debounced.
 * ============================================================================
 */

import type {
  CanvasLayoutItem,
  WidgetInstance,
} from "@/components/canvas/GridCanvas";
import type { Json } from "@/types/database";

/* ----------------------------- UI-side board ------------------------------ */

/** Board metadata carried by the canvas (mirrors a pb_dashboards row). */
export interface BoardMeta {
  /** uuid — same value as pb_dashboards.id. */
  id: string;
  name: string;
  /** Single-default invariant: at most one board has isDefault=true. */
  isDefault: boolean;
  /** Board ordering (pb_dashboards.sort_order). */
  sortOrder: number;
}

/** A board with its placed widgets + their desktop layout. */
export interface BoardState {
  meta: BoardMeta;
  instances: WidgetInstance[];
  layout: CanvasLayoutItem[];
}

/* ------------------------- persisted layout shape ------------------------- */

/**
 * The jsonb stored in `pb_widgets.layout`. x/y/w/h are the lg-breakpoint
 * placement; min/max are persisted defensively (derived from the registry).
 */
export interface PersistedLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** Read x/y/w/h out of a `pb_widgets.layout` jsonb value, tolerating shape drift. */
export function layoutFromJson(
  value: Json | null | undefined,
  instanceId: string,
): CanvasLayoutItem {
  const o = (value ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    instanceId,
    x: Math.max(0, num(o.x, 0)),
    y: Math.max(0, num(o.y, 0)),
    w: Math.max(1, num(o.w, 3)),
    h: Math.max(1, num(o.h, 2)),
  };
}

/** Build the jsonb to store in `pb_widgets.layout` for one instance. */
export function layoutToJson(
  item: CanvasLayoutItem,
  bounds?: { minW?: number; minH?: number; maxW?: number; maxH?: number },
): PersistedLayout {
  const out: PersistedLayout = { x: item.x, y: item.y, w: item.w, h: item.h };
  if (bounds) {
    if (Number.isFinite(bounds.minW)) out.minW = bounds.minW;
    if (Number.isFinite(bounds.minH)) out.minH = bounds.minH;
    if (Number.isFinite(bounds.maxW)) out.maxW = bounds.maxW;
    if (Number.isFinite(bounds.maxH)) out.maxH = bounds.maxH;
  }
  return out;
}
