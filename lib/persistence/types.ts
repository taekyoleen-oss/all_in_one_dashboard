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
 * Grid resolution version. v1 = the original 12-col / 96px grid; v2 = the finer
 * 24-col / 48px grid. Each widget's layout jsonb carries its own `gv`, so the
 * migration is PER-WIDGET and idempotent (no bulk pass, no schema change, safe
 * across devices): a v1 (or unmarked) layout is scaled ×2 on READ to reach the
 * v2 runtime; every WRITE stamps gv=2. Doubling COLS/ROW_HEIGHT and HALVING the
 * margin keeps the on-screen size identical while making resize steps finer.
 */
export const GRID_VERSION = 2;
const GRID_V1_TO_V2 = 2;

/**
 * The jsonb stored in `pb_widgets.layout`. x/y/w/h are the lg-breakpoint
 * placement; min/max are persisted defensively (derived from the registry).
 * `gv` records the grid resolution the x/y/w/h are expressed in.
 */
export interface PersistedLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Grid version of these coords (absent ⇒ legacy v1). */
  gv?: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** Read x/y/w/h out of a `pb_widgets.layout` jsonb value, tolerating shape drift.
 *  Legacy (v1 / unmarked) coords are scaled to the current grid resolution. */
export function layoutFromJson(
  value: Json | null | undefined,
  instanceId: string,
): CanvasLayoutItem {
  const o = (value ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  // Scale legacy coords up to the current resolution (v1 → ×2). v2 stays ×1.
  const gv = typeof o.gv === "number" && o.gv >= GRID_VERSION ? GRID_VERSION : 1;
  const s = gv >= GRID_VERSION ? 1 : GRID_V1_TO_V2;
  return {
    instanceId,
    x: Math.max(0, Math.round(num(o.x, 0) * s)),
    y: Math.max(0, Math.round(num(o.y, 0) * s)),
    w: Math.max(1, Math.round(num(o.w, 3) * s)),
    h: Math.max(1, Math.round(num(o.h, 2) * s)),
  };
}

/** Build the jsonb to store in `pb_widgets.layout` for one instance (always v2). */
export function layoutToJson(
  item: CanvasLayoutItem,
  bounds?: { minW?: number; minH?: number; maxW?: number; maxH?: number },
): PersistedLayout {
  const out: PersistedLayout = {
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    gv: GRID_VERSION,
  };
  if (bounds) {
    if (Number.isFinite(bounds.minW)) out.minW = bounds.minW;
    if (Number.isFinite(bounds.minH)) out.minH = bounds.minH;
    if (Number.isFinite(bounds.maxW)) out.maxW = bounds.maxW;
    if (Number.isFinite(bounds.maxH)) out.maxH = bounds.maxH;
  }
  return out;
}
