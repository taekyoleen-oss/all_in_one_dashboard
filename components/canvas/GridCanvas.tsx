"use client";

/**
 * GridCanvas — the react-grid-layout (v2) canvas (설계서 §6.1–6.2).
 *
 *  ⚠ react-grid-layout@2.x has a different API from v1 / @types/react-grid-layout:
 *    • `WidthProvider` HOC is GONE → we measure width with the `useContainerWidth`
 *      hook ({ width, containerRef, mounted }).
 *    • drag/resize/compaction are configured via OBJECTS, not v1 props:
 *        - compactType:'vertical'  → compactor={verticalCompactor}
 *        - isDraggable/draggableHandle → dragConfig={{ enabled, handle }}
 *        - isResizable/resizeHandles    → resizeConfig={{ enabled, handles }}
 *    • onLayoutChange signature is (layout, layouts).
 *    • min/max come from per-item minW/minH/maxW/maxH on each LayoutItem.
 *
 *  Breakpoints: lg >1024 (12col, desktop — the persisted source of truth) /
 *  md >640 (6col, tablet·foldable — flow-packed to fill the width) / sm ≤640
 *  (1col stack, mobile — one widget per row). Only the lg layout is persisted;
 *  md/sm are DERIVED from lg each render (re-flowed to fill the narrower grid),
 *  so phones/tablets get a layout that fills the screen without ever clobbering
 *  the desktop arrangement (handleLayoutChange guards persistence to lg only).
 *  Each widget instance is rendered through a registry lookup and keyed by its
 *  `instanceId`, so two instances of the same type hold **independent** state.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { Expand } from "lucide-react";
import {
  Responsive,
  useContainerWidth,
  cloneLayout,
  getBreakpointFromWidth,
  type Compactor,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { calcXY } from "react-grid-layout";
import type { WidgetRegistry, Density } from "@/lib/widgets/contract";
import { WidgetFrame } from "./WidgetFrame";
import { getDragType, clearDragType } from "@/lib/utils/dragSource";
import { usePersistedFontScale } from "@/lib/utils/fontScale";
import { usePersistedColor, tintBackground } from "@/lib/utils/widgetColor";
import { usePersistedTitle } from "@/lib/utils/widgetTitle";
import {
  readMobileLayout,
  writeMobileLayout,
  type StoredLayout,
} from "@/lib/utils/mobileLayout";

/* ------------------------------- public types ----------------------------- */

/** A placed widget on the canvas. `config` is the widget's own jsonb config. */
export interface WidgetInstance {
  instanceId: string;
  type: string;
  config: unknown;
}

/** Per-instance grid placement (one entry per instance). */
export interface CanvasLayoutItem {
  instanceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BreakpointKey = "lg" | "md" | "sm";

export interface GridCanvasProps {
  /** Widget definitions keyed by type. */
  registry: WidgetRegistry;
  /** Widget instances to render. */
  instances: WidgetInstance[];
  /** Desktop (lg) layout — the persisted source of truth. */
  layout: CanvasLayoutItem[];
  /** Called when the user drags/resizes (lg layout only — see note below). */
  onLayoutChange?: (next: CanvasLayoutItem[]) => void;
  /**
   * Edit mode: when false, drag + resize are disabled (the 잠금 lock toggle in
   * Toolbar flips this). Defaults to true. Drop is also disabled while locked.
   */
  editable?: boolean;
  /**
   * Called when a widget type is dropped from the palette. Receives the dragged
   * `type` plus the grid placement RGL computed for the drop. The parent mints a
   * new instance (see lib/utils/grid.createInstance) and appends it.
   */
  onDropWidget?: (
    type: string,
    placement: { x: number; y: number; w: number; h: number },
  ) => void;
  /**
   * Default grid size for the drop placeholder (so the ghost matches the widget
   * the user is dragging). Falls back to a small tile.
   */
  dropItemSize?: { w: number; h: number };
  /**
   * Per-instance header actions (the widget menu). Render-prop so the parent can
   * inject a menu wired to copy/paste/delete/focus/edit/lock for each instance.
   */
  renderActions?: (instance: WidgetInstance) => React.ReactNode;
  /**
   * Open a widget full-screen (the "전체" button in each tile header → FocusOverlay).
   * Wired to the same focus path as the ⋮ menu's 자세히.
   */
  onFocusInstance?: (instanceId: string) => void;
  /**
   * Stable key (the board id) for device-local mobile/tablet layouts. md/sm edits
   * persist to localStorage under this key instead of the DB, so a phone keeps its
   * own arrangement without clobbering the desktop (lg) layout.
   */
  storageKey?: string;
}

/* --------------------------------- config --------------------------------- */

// Responsive breakpoints (RGL rule: a breakpoint is active when width > value).
//  • lg (>1024px, desktop): 12 cols. The PERSISTED source of truth. Within lg
//    the column WIDTH flexes with the container but every tile keeps its grid
//    x/y/w/h, so desktop positions never change on resize/zoom (요구: 위치 불변).
//  • md (>640px, tablet·foldable): 6 cols. DERIVED from lg and flow-packed so a
//    few widgets sit side-by-side and FILL the width (toFlowLayout).
//  • sm (≤640px, mobile): 1 col. DERIVED — one widget per row, full-width stack.
// Only lg is persisted (handleLayoutChange), so phone/tablet reflows never
// overwrite the desktop arrangement. The 재정렬 button re-packs lg (CanvasShell).
const BREAKPOINTS: Record<BreakpointKey, number> = { lg: 1024, md: 640, sm: 0 };
// v2 grid: DOUBLED resolution for finer placement/resize. COLS 12→24 and
// ROW_HEIGHT 96→48; MARGIN halved 12→6 so a v2 tile (coords ×2) renders at the
// SAME on-screen size as before — only the step granularity gets finer. Stored
// layouts are migrated per-widget on read (see persistence/types.ts gv).
const COLS: Record<BreakpointKey, number> = { lg: 24, md: 12, sm: 1 };
const ROW_HEIGHT = 48;
const MARGIN: [number, number] = [6, 6];
const CONTAINER_PADDING: [number, number] = [0, 0];
/** RGL v2's external-drop placeholder id (must match its internal default). */
const DROPPING_ITEM_ID = "__dropping-elem__";

// Free placement is implemented by a per-component compactor (see GridCanvas):
// type:null + no-op compact keep positions put on resize/zoom/drag, while a
// resize-time clamp stops a growing tile from overlapping its neighbors. The
// "다른 앱 밀기" button then pushes neighbors down to make room.

/** Map a measured tile pixel-width to a coarse density bucket. */
function densityForWidth(px: number): Density {
  if (px < 220) return "compact";
  if (px < 360) return "cozy";
  return "comfortable";
}

/** Build a react-grid-layout `Layout` for a breakpoint, clamping per-widget min/max. */
function toRglLayout(
  items: CanvasLayoutItem[],
  instances: WidgetInstance[],
  registry: WidgetRegistry,
  cols: number,
): Layout {
  const typeOf = new Map(instances.map((i) => [i.instanceId, i.type]));
  return items.map<LayoutItem>((it) => {
    const def = registry[typeOf.get(it.instanceId) ?? ""];
    const min = def?.minSize ?? { w: 1, h: 1 };
    const max = def?.maxSize ?? { w: cols, h: Infinity };
    // sm is a single column: force full-width stacking.
    const w = cols === 1 ? 1 : Math.min(Math.max(it.w, min.w), max.w);
    return {
      i: it.instanceId,
      x: cols === 1 ? 0 : Math.min(it.x, Math.max(0, cols - w)),
      y: it.y,
      w,
      h: Math.min(Math.max(it.h, min.h), max.h),
      minW: cols === 1 ? 1 : min.w,
      minH: min.h,
      maxW: cols === 1 ? 1 : max.w,
      maxH: max.h,
    };
  });
}

/**
 * First top-left grid slot (scanning rows top→down, cols left→right) where a
 * w×h rect fits without overlapping anything already placed. Drives the flow
 * packing for derived (tablet/mobile) layouts.
 */
function firstFreeSlot(
  placed: LayoutItem[],
  w: number,
  h: number,
  cols: number,
): { x: number; y: number } {
  for (let y = 0; ; y += 1) {
    for (let x = 0; x <= cols - w; x += 1) {
      const rect = { x, y, w, h };
      if (!placed.some((p) => rectsOverlap(rect, p))) return { x, y };
    }
  }
}

/**
 * Build a DERIVED (non-desktop) layout that FILLS a narrower grid. We do NOT keep
 * the desktop x positions (they'd leave gaps / overflow at fewer cols). Instead:
 *  1) take widgets in reading order (top→bottom, then left→right) from the lg layout,
 *  2) scale each width from 12 cols down to `cols` (clamped to the widget's min/max;
 *     forced to full width when cols === 1, i.e. mobile = one per row),
 *  3) flow-pack them with firstFreeSlot so they tuck together and fill the width.
 * The result is recomputed every render and never persisted (lg stays canonical).
 */
function toFlowLayout(
  items: CanvasLayoutItem[],
  instances: WidgetInstance[],
  registry: WidgetRegistry,
  cols: number,
): Layout {
  const typeOf = new Map(instances.map((i) => [i.instanceId, i.type]));
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutItem[] = [];
  for (const it of ordered) {
    const def = registry[typeOf.get(it.instanceId) ?? ""];
    const min = def?.minSize ?? { w: 1, h: 1 };
    const max = def?.maxSize ?? { w: cols, h: Infinity };
    const maxW = Math.min(max.w, cols);
    const w =
      cols === 1
        ? 1
        : Math.min(Math.max(Math.round((it.w / COLS.lg) * cols), min.w), maxW);
    const h = Math.min(Math.max(it.h, min.h), max.h);
    const { x, y } = firstFreeSlot(placed, w, h, cols);
    placed.push({
      i: it.instanceId,
      x,
      y,
      w,
      h,
      minW: cols === 1 ? 1 : min.w,
      minH: min.h,
      maxW: cols === 1 ? 1 : maxW,
      maxH: max.h,
    });
  }
  return placed;
}

/**
 * DEVICE-LOCAL (mobile/tablet) layout: like toFlowLayout, but seeded from a
 * stored per-기기 layout (localStorage). Instances present in `stored` keep their
 * saved x/y/w/h (clamped to the widget's min/max and this breakpoint's cols);
 * instances NOT in `stored` (e.g. added later on desktop) flow-pack into the
 * first free slots so nothing overlaps. When `stored` is null we fall back to the
 * fully-derived flow layout (toFlowLayout). Never persisted to the DB.
 */
function toDeviceLayout(
  items: CanvasLayoutItem[],
  instances: WidgetInstance[],
  registry: WidgetRegistry,
  cols: number,
  stored: StoredLayout | null,
): Layout {
  if (!stored) return toFlowLayout(items, instances, registry, cols);
  const typeOf = new Map(instances.map((i) => [i.instanceId, i.type]));
  const lgById = new Map(items.map((it) => [it.instanceId, it]));
  const placed: LayoutItem[] = [];
  const bounds = (id: string) => {
    const def = registry[typeOf.get(id) ?? ""];
    return {
      min: def?.minSize ?? { w: 1, h: 1 },
      max: def?.maxSize ?? { w: cols, h: Infinity },
    };
  };
  // 1) Instances with a saved cell → honor it (clamped).
  for (const inst of instances) {
    const s = stored[inst.instanceId];
    if (!s) continue;
    const { min, max } = bounds(inst.instanceId);
    const maxW = Math.min(max.w, cols);
    const w = cols === 1 ? 1 : Math.min(Math.max(s.w, min.w), maxW);
    const h = Math.min(Math.max(s.h, min.h), max.h);
    const x = cols === 1 ? 0 : Math.min(Math.max(0, s.x), Math.max(0, cols - w));
    placed.push({
      i: inst.instanceId,
      x,
      y: Math.max(0, s.y),
      w,
      h,
      minW: cols === 1 ? 1 : min.w,
      minH: min.h,
      maxW: cols === 1 ? 1 : maxW,
      maxH: max.h,
    });
  }
  // 2) Instances without a saved cell → flow-pack into the free space.
  for (const inst of instances) {
    if (stored[inst.instanceId]) continue;
    const { min, max } = bounds(inst.instanceId);
    const maxW = Math.min(max.w, cols);
    const lg = lgById.get(inst.instanceId);
    const w =
      cols === 1
        ? 1
        : Math.min(
            Math.max(Math.round(((lg?.w ?? min.w) / COLS.lg) * cols), min.w),
            maxW,
          );
    const h = Math.min(Math.max(lg?.h ?? min.h, min.h), max.h);
    const { x, y } = firstFreeSlot(placed, w, h, cols);
    placed.push({
      i: inst.instanceId,
      x,
      y,
      w,
      h,
      minW: cols === 1 ? 1 : min.w,
      minH: min.h,
      maxW: cols === 1 ? 1 : maxW,
      maxH: max.h,
    });
  }
  return placed;
}

/* ----------------------------- hover-to-fit (②) --------------------------- */

/** Plain x/y/w/h rect in grid units (the dropping item is one of these). */
interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Do two grid rects overlap? (shared-edge touching is NOT an overlap). */
function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Largest free w×h that fits at grid cell (x,y) without overlapping any existing
 * item, clamped to [min, max]/cols. Used by the drop hover-dwell to tuck the
 * placeholder into a small gap (②). Greedy: grow width to the first obstacle,
 * then grow height to the first obstacle within that width.
 */
function freeFitAt(
  others: GridRect[],
  x: number,
  y: number,
  bounds: { minW: number; minH: number; maxW: number; maxH: number },
  cols: number,
): { w: number; h: number } {
  const maxW = Math.min(bounds.maxW, cols - x);
  // Grow width: stop just before the nearest item that starts to our right on an
  // overlapping row band (assume max height first so any row-blocker counts).
  let w = Math.max(bounds.minW, 1);
  while (
    w < maxW &&
    !others.some((o) =>
      rectsOverlap({ x, y, w: w + 1, h: bounds.minH }, o),
    )
  ) {
    w += 1;
  }
  // Grow height within that width.
  let h = Math.max(bounds.minH, 1);
  while (
    h < bounds.maxH &&
    !others.some((o) => rectsOverlap({ x, y, w, h: h + 1 }, o))
  ) {
    h += 1;
  }
  return { w, h };
}

/** A single grid cell: measures its own width → derives density → renders CompactView. */
function CanvasCell({
  instance,
  registry,
  actions,
  onExpand,
}: {
  instance: WidgetInstance;
  registry: WidgetRegistry;
  actions?: React.ReactNode;
  onExpand?: () => void;
}) {
  const cellRef = React.useRef<HTMLDivElement | null>(null);
  const [density, setDensity] = React.useState<Density>("cozy");
  // Per-instance 글자 크기 (zoom factor). The ⋮-menu control writes the same key,
  // so the tile re-scales live. Density (above) is measured on the UNZOOMED cell,
  // so the reflow bucket stays correct regardless of font scale.
  const { scale } = usePersistedFontScale(instance.instanceId);
  // Per-instance 앱 색 (pastel tint blended over --card; readable in both themes).
  const { color } = usePersistedColor(instance.instanceId);
  const tint = tintBackground(color);
  // Per-instance custom title (double-click the header to rename). Stored in
  // localStorage (per device) so a widget's ConfigEditor can't drop it.
  const { title: customTitle, setTitle } = usePersistedTitle(instance.instanceId);

  React.useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setDensity(densityForWidth(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const def = registry[instance.type];
  if (!def) {
    return (
      <div ref={cellRef} className="h-full w-full">
        <WidgetFrame
          title={`알 수 없는 위젯: ${instance.type}`}
          actions={actions}
          tint={tint}
          onExpand={onExpand}
        >
          <p className="text-xs text-muted-foreground">
            레지스트리에 등록되지 않은 타입입니다.
          </p>
        </WidgetFrame>
      </div>
    );
  }

  const { CompactView, displayName } = def;
  const icon =
    typeof def.icon === "string" || def.icon == null
      ? null
      : React.createElement(def.icon, { size: 16 });

  return (
    <div ref={cellRef} className="h-full w-full">
      <WidgetFrame
        title={customTitle || displayName}
        icon={icon}
        actions={actions}
        tint={tint}
        onTitleChange={(next) => setTitle(next || null)}
        onExpand={onExpand}
      >
        {/* Per-instance 글자 크기: CSS zoom scales the whole subtree (text +
            spacing). h-full keeps the height chain intact so fill-frame widgets
            still fill and list widgets keep their own inner scroll. */}
        <div
          className="h-full"
          style={
            scale !== 1 ? ({ zoom: scale } as React.CSSProperties) : undefined
          }
        >
          {/* Keyed by instanceId ⇒ independent state across instances of one type. */}
          <CompactView
            key={instance.instanceId}
            config={instance.config}
            instanceId={instance.instanceId}
            density={density}
          />
        </div>
      </WidgetFrame>
    </div>
  );
}

/* --------------------------- push-on-resize (밀기) ------------------------- */

/**
 * Anchor `anchorId` at its (grown) size and push every OTHER item that overlaps
 * it straight down, cascading, until nothing overlaps. x positions are preserved
 * (only y moves), so the board stays where the user put things — the resized tile
 * just claims the room it needs and shoves the colliding tiles down by exactly
 * the overlap. Used by the "다른 앱 밀기" button.
 */
function pushResolveDown(
  items: CanvasLayoutItem[],
  anchorId: string,
): CanvasLayoutItem[] {
  const anchor = items.find((i) => i.instanceId === anchorId);
  if (!anchor) return items;
  const rest = items
    .filter((i) => i.instanceId !== anchorId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: CanvasLayoutItem[] = [{ ...anchor }];
  for (const it of rest) {
    const cur = { ...it };
    let guard = 0;
    let moved = true;
    while (moved && guard < 2000) {
      moved = false;
      guard += 1;
      for (const p of placed) {
        if (rectsOverlap(cur, p)) {
          cur.y = p.y + p.h;
          moved = true;
        }
      }
    }
    placed.push(cur);
  }
  return placed;
}

/**
 * Push every item that overlaps `anchor` (a virtual rect) straight DOWN, cascading,
 * until nothing overlaps it — while keeping `keepId` (the tile being dragged) put.
 * Used by the drag-dwell (요구: 드래그하여 멈춰있으면 그 공간의 앱 + 연속된 앱들이
 * 아래로 이동). Only y moves (x preserved), so columns stay where the user set them.
 */
function pushBelowRect(
  items: CanvasLayoutItem[],
  anchor: GridRect,
  keepId: string,
): CanvasLayoutItem[] {
  const kept = items.find((i) => i.instanceId === keepId);
  const movable = items
    .filter((i) => i.instanceId !== keepId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const blocks: GridRect[] = [{ ...anchor }];
  const out: CanvasLayoutItem[] = [];
  for (const it of movable) {
    const cur = { ...it };
    let guard = 0;
    let moved = true;
    while (moved && guard < 4000) {
      moved = false;
      guard += 1;
      for (const b of blocks) {
        if (rectsOverlap(cur, b)) {
          cur.y = b.y + b.h;
          moved = true;
        }
      }
    }
    out.push(cur);
    blocks.push({ x: cur.x, y: cur.y, w: cur.w, h: cur.h });
  }
  return kept ? [kept, ...out] : out;
}

/** Floating "다른 앱 밀기" button anchored to the resized tile's SE corner. */
function PushPrompt({
  containerRef,
  instanceId,
  onConfirm,
  onDismiss,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  instanceId: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  React.useLayoutEffect(() => {
    const place = () => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        `[data-pb-instance="${instanceId}"]`,
      );
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const margin = 8;
      const top = Math.min(r.bottom - 6, window.innerHeight - 40);
      const left = Math.min(r.right - 6, window.innerWidth - margin);
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // Auto-dismiss so a stale prompt never lingers.
    const t = window.setTimeout(onDismiss, 8000);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.clearTimeout(t);
    };
  }, [containerRef, instanceId, onDismiss]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <button
      type="button"
      onClick={onConfirm}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translate(-100%, 0)",
      }}
      className="z-[85] inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring motion-safe:animate-[pb-overlay-in_160ms_ease-out]"
    >
      <Expand size={13} aria-hidden />
      다른 앱 밀기
    </button>,
    document.body,
  );
}

/* -------------------------------- GridCanvas ------------------------------- */

export function GridCanvas({
  registry,
  instances,
  layout,
  onLayoutChange,
  editable = true,
  onDropWidget,
  dropItemSize,
  renderActions,
  onFocusInstance,
  storageKey = "",
}: GridCanvasProps) {
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1280,
  });

  // The breakpoint RGL is actually rendering at, derived from the measured width
  // with RGL's own rule (width > breakpoint). Used to guard layout persistence so
  // an md/sm emission can never overwrite the lg widths (issue ①). Memoized so it
  // only recomputes when the width crosses a breakpoint boundary.
  const activeBp = React.useMemo(
    () => getBreakpointFromWidth(BREAKPOINTS, width),
    [width],
  );
  const activeBpRef = React.useRef<BreakpointKey>(activeBp);
  React.useEffect(() => {
    activeBpRef.current = activeBp;
  }, [activeBp]);

  /* --------------- device-local (mobile/tablet) layout state --------------- */
  // md/sm edits persist HERE (localStorage), never to the DB lg layout. Loaded on
  // mount / when the board (storageKey) changes; null → derive via toFlowLayout.
  // SSR + first client render both start null (= derived), so no hydration drift.
  const [deviceLayouts, setDeviceLayouts] = React.useState<{
    md: StoredLayout | null;
    sm: StoredLayout | null;
  }>({ md: null, sm: null });
  React.useEffect(() => {
    // Load device-local layouts for this board (client-only; localStorage is not
    // readable during SSR/first render, so this MUST run in an effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external store (localStorage) → state on mount/board-change
    setDeviceLayouts({
      md: readMobileLayout(storageKey, "md"),
      sm: readMobileLayout(storageKey, "sm"),
    });
  }, [storageKey]);

  // Snapshot a breakpoint's RGL layout into localStorage (per board+bp). Guarded
  // against RGL's transient/incomplete emissions: only persist when every current
  // instance is present (and the dropping placeholder is dropped). md/sm only —
  // never the DB lg layout.
  const persistDeviceLayout = React.useCallback(
    (bp: "md" | "sm", src: Layout) => {
      const real = src.filter((it) => it.i !== DROPPING_ITEM_ID);
      if (real.length !== instances.length) return;
      const map: StoredLayout = {};
      for (const it of real) {
        map[it.i] = { x: it.x, y: it.y, w: it.w, h: it.h };
      }
      writeMobileLayout(storageKey, bp, map);
      setDeviceLayouts((prev) => ({ ...prev, [bp]: map }));
    },
    [instances.length, storageKey],
  );

  /* ----------------------- push-on-resize (밀기) state ---------------------- */
  // While a tile is being resized, the compactor CLAMPS it so it never overlaps a
  // neighbor (clean "can't grow past" feel). We also stash the DESIRED (raw) size
  // and, when a clamp happened, surface a "다른 앱 밀기" button; clicking it grows
  // the tile to the desired size and pushes the colliding tiles down.
  const resizingIdRef = React.useRef<string | null>(null);
  const desiredRef = React.useRef<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const clampHappenedRef = React.useRef(false);
  const promptTimerRef = React.useRef<number | null>(null);
  const promptShownRef = React.useRef<string | null>(null);
  // Auto-push: fires when the user HOLDS the resize still for ~1s against a
  // neighbor (요구: 드래그한 채 1초 가만히 있으면 옆 앱이 밀려가도록). applyPushRef
  // always points at the latest applyPush so the timer pushes with current state.
  const autoPushTimerRef = React.useRef<number | null>(null);
  const applyPushRef = React.useRef<() => void>(() => {});
  const [pushPromptId, setPushPromptId] = React.useState<string | null>(null);

  const clearAutoPush = React.useCallback(() => {
    if (autoPushTimerRef.current != null) {
      window.clearTimeout(autoPushTimerRef.current);
      autoPushTimerRef.current = null;
    }
  }, []);

  const clearPushPrompt = React.useCallback(() => {
    if (promptTimerRef.current != null) {
      window.clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
    clearAutoPush();
    desiredRef.current = null;
    clampHappenedRef.current = false;
    if (promptShownRef.current != null) {
      promptShownRef.current = null;
      setPushPromptId(null);
    }
  }, [clearAutoPush, setPushPromptId]);

  const schedulePushPrompt = React.useCallback((id: string) => {
    if (promptShownRef.current === id || promptTimerRef.current != null) return;
    // Short dwell so a quick/accidental clamp doesn't flash the button (요구: 늘려서 기다리면).
    promptTimerRef.current = window.setTimeout(() => {
      promptTimerRef.current = null;
      promptShownRef.current = id;
      setPushPromptId(id);
    }, 450);
  }, []);

  // Collision-clamping compactor. type:null + allowOverlap:false keep free
  // placement (no float-up, drag doesn't push — see §6.2). The custom compact:
  //  • while resizing: shrink the resized tile so it can't overlap others (this
  //    is RGL's rendered state, so the clamp shows live, not just on commit);
  //  • otherwise: no-op clone (positions stay put on resize/zoom/drag).
  const compactor = React.useMemo<Compactor>(
    () => ({
      type: null,
      allowOverlap: false,
      preventCollision: true,
      compact: (lay: Layout) => {
        const id = resizingIdRef.current;
        if (!id) return cloneLayout(lay);
        const item = lay.find((l) => l.i === id);
        if (!item) return cloneLayout(lay);
        const others = lay.filter((l) => l.i !== id);
        // The item arrives here at the RAW dragged size → record it as desired.
        desiredRef.current = { id, x: item.x, y: item.y, w: item.w, h: item.h };
        const minW = item.minW ?? 1;
        const minH = item.minH ?? 1;
        const fits = (w: number, h: number) =>
          !others.some((o) => rectsOverlap({ x: item.x, y: item.y, w, h }, o));
        // Prefer keeping width (downward growth is the common case): shrink h
        // first, then w if still colliding.
        let h = item.h;
        while (h > minH && !fits(item.w, h)) h -= 1;
        let w = item.w;
        while (w > minW && !fits(w, h)) w -= 1;
        clampHappenedRef.current = w < item.w || h < item.h;
        if (!clampHappenedRef.current) return cloneLayout(lay);
        return cloneLayout(
          lay.map((l) => (l.i === id ? { ...l, w, h } : l)),
        );
      },
    }),
    [],
  );

  const onResizeStart = React.useCallback(
    (_lay: Layout, oldItem: LayoutItem | null) => {
      clearPushPrompt();
      resizingIdRef.current = oldItem?.i ?? null;
      clampHappenedRef.current = false;
    },
    [clearPushPrompt],
  );

  const onResizeTick = React.useCallback(() => {
    // The "다른 앱 밀기" push affordance operates on the DB (lg) layout, so it only
    // runs on desktop. On md/sm the compactor still CLAMPS (no overlap); the resize
    // just commits device-local on release.
    if (activeBpRef.current !== "lg") {
      clearAutoPush();
      return;
    }
    // compact() (run just before this) set clampHappenedRef + desiredRef.
    if (resizingIdRef.current && clampHappenedRef.current) {
      schedulePushPrompt(resizingIdRef.current);
      // AUTO-PUSH on hold: this fires only if no further onResize arrives for ~1s
      // (the pointer is held still against the neighbor). Each move resets it.
      if (autoPushTimerRef.current != null)
        window.clearTimeout(autoPushTimerRef.current);
      autoPushTimerRef.current = window.setTimeout(() => {
        autoPushTimerRef.current = null;
        applyPushRef.current();
      }, 1000);
    } else {
      clearAutoPush();
    }
  }, [schedulePushPrompt, clearAutoPush]);

  const onResizeStop = React.useCallback(
    (lay: Layout) => {
      resizingIdRef.current = null;
      // Cancel a pending auto-push on release; the post-release button still works.
      clearAutoPush();
      // md/sm: commit the resized arrangement device-local (never the DB lg layout).
      const bp = activeBpRef.current;
      if (bp === "md" || bp === "sm") persistDeviceLayout(bp, lay);
      // Keep desiredRef + the prompt so the button stays clickable after release (lg).
    },
    [clearAutoPush, persistDeviceLayout],
  );

  // Apply the push: grow the tile to its desired size and shove colliders down.
  const applyPush = React.useCallback(() => {
    const d = desiredRef.current;
    if (!d) {
      clearPushPrompt();
      return;
    }
    const others = layout.filter((i) => i.instanceId !== d.id);
    const grown: CanvasLayoutItem = {
      instanceId: d.id,
      x: d.x,
      y: d.y,
      w: Math.min(d.w, COLS.lg - d.x),
      h: d.h,
    };
    onLayoutChange?.(pushResolveDown([grown, ...others], d.id));
    clearPushPrompt();
  }, [layout, onLayoutChange, clearPushPrompt]);
  // Keep the ref pointing at the latest applyPush so the auto-push timer (set in
  // onResizeTick) always pushes using the current layout/desired state.
  applyPushRef.current = applyPush;

  /* ------------------------ drag-dwell push-down (②) ----------------------- */
  // 요구: 개별 앱을 드래그하여 어떤 공간 위에서 ~멈춰 있으면~, 그 공간의 앱 + 그 아래로
  // 연속된 앱들이 아래로 밀려난다. Free placement + preventCollision means the dragged
  // tile would normally just snap to the nearest gap; instead we read the POINTER's
  // target cell, and when it's held still over occupied cells, push those tiles
  // (cascading) down so the dragged tile can land where the user is pointing. Only
  // on desktop (lg) — the DB layout — where free placement needs this.
  const dragIdRef = React.useRef<string | null>(null);
  const dragSizeRef = React.useRef<{ w: number; h: number }>({ w: 1, h: 1 });
  const dragCellRef = React.useRef<{ x: number; y: number } | null>(null);
  const dragPushTimerRef = React.useRef<number | null>(null);
  const applyDragPushRef = React.useRef<() => void>(() => {});

  // Map a pointer event to the grid cell the dragged tile's TOP-LEFT should take,
  // centering the tile under the cursor (matches where the user is aiming).
  const pointerDragCell = React.useCallback(
    (e: Event, w: number, h: number): { x: number; y: number } | null => {
      const gridEl = containerRef.current?.querySelector<HTMLElement>(
        ".react-grid-layout",
      );
      if (!gridEl) return null;
      const me = e as MouseEvent & { touches?: TouchList };
      const cx = me.touches?.[0]?.clientX ?? me.clientX;
      const cy = me.touches?.[0]?.clientY ?? me.clientY;
      if (typeof cx !== "number" || typeof cy !== "number") return null;
      const cols = COLS.lg;
      const colWidth = (width - MARGIN[0] * (cols - 1)) / cols;
      const rect = gridEl.getBoundingClientRect();
      const tileWpx = w * colWidth + (w - 1) * MARGIN[0];
      // Horizontally center the tile under the cursor; vertically the user grabs
      // the HEADER (top), so track the cursor's row (offset by ~half a row), which
      // matches where the dragged tile visually sits.
      const left = Math.max(0, cx - rect.left - tileWpx / 2);
      const top = Math.max(0, cy - rect.top - ROW_HEIGHT / 2);
      const positionParams = {
        cols,
        margin: MARGIN,
        maxRows: Infinity,
        rowHeight: ROW_HEIGHT,
        containerWidth: width,
        containerPadding: CONTAINER_PADDING,
      } as const;
      return calcXY(positionParams, top, left, w, h);
    },
    [containerRef, width],
  );

  // Push the occupiers below the held cell (keeps the dragged tile put). Reads the
  // latest layout via layoutRef so the timer never pushes stale state.
  const applyDragPush = React.useCallback(() => {
    const id = dragIdRef.current;
    const cell = dragCellRef.current;
    if (!id || !cell) return;
    const { w, h } = dragSizeRef.current;
    const anchor: GridRect = {
      x: Math.min(Math.max(0, cell.x), Math.max(0, COLS.lg - w)),
      y: Math.max(0, cell.y),
      w,
      h,
    };
    const next = pushBelowRect(layoutRef.current, anchor, id);
    onLayoutChange?.(next);
    dragPushTimerRef.current = null;
  }, [onLayoutChange]);
  applyDragPushRef.current = applyDragPush;

  const onDragStart = React.useCallback(
    (_lay: Layout, oldItem: LayoutItem | null) => {
      clearPushPrompt();
      if (activeBpRef.current !== "lg" || !oldItem) {
        dragIdRef.current = null;
        return;
      }
      dragIdRef.current = oldItem.i;
      dragSizeRef.current = { w: oldItem.w, h: oldItem.h };
      dragCellRef.current = null;
    },
    [clearPushPrompt],
  );

  const onDragTick = React.useCallback(
    (lay: Layout, _o: LayoutItem | null, _n: LayoutItem | null, _p: LayoutItem | null, e: Event) => {
      const id = dragIdRef.current;
      if (!id || activeBpRef.current !== "lg") return;
      const cell = pointerDragCell(e, dragSizeRef.current.w, dragSizeRef.current.h);
      if (!cell) return;
      const { w, h } = dragSizeRef.current;
      const anchor: GridRect = {
        x: Math.min(Math.max(0, cell.x), Math.max(0, COLS.lg - w)),
        y: Math.max(0, cell.y),
        w,
        h,
      };
      // Does any OTHER tile sit in the held space? (use the live RGL layout)
      const blocked = lay.some(
        (it) => it.i !== id && it.i !== DROPPING_ITEM_ID && rectsOverlap(anchor, it),
      );
      if (!blocked) {
        if (dragPushTimerRef.current != null) {
          window.clearTimeout(dragPushTimerRef.current);
          dragPushTimerRef.current = null;
        }
        dragCellRef.current = cell;
        return;
      }
      const prev = dragCellRef.current;
      if (!prev || prev.x !== anchor.x || prev.y !== anchor.y) {
        // Cell moved → restart the dwell. Holding still ~500ms then pushes down.
        dragCellRef.current = { x: anchor.x, y: anchor.y };
        if (dragPushTimerRef.current != null)
          window.clearTimeout(dragPushTimerRef.current);
        dragPushTimerRef.current = window.setTimeout(() => {
          applyDragPushRef.current();
        }, 500);
      }
      // Same cell + timer already running → let it ride (this is "멈춰 있음").
    },
    [pointerDragCell],
  );

  const onDragStop = React.useCallback(
    (lay: Layout) => {
      if (dragPushTimerRef.current != null) {
        window.clearTimeout(dragPushTimerRef.current);
        dragPushTimerRef.current = null;
      }
      dragIdRef.current = null;
      dragCellRef.current = null;
      // md/sm: commit this device's arrangement locally (never the DB lg layout).
      const bp = activeBpRef.current;
      if (bp === "md" || bp === "sm") persistDeviceLayout(bp, lay);
    },
    [persistDeviceLayout],
  );

  // Derive per-breakpoint layouts from the single persisted (lg) layout. lg keeps
  // the exact desktop x/y/w/h; md/sm are re-flowed to fill the narrower grid
  // (tablet = a few across, mobile = one per row). See toFlowLayout.
  const layouts = React.useMemo<ResponsiveLayouts<BreakpointKey>>(
    () => ({
      lg: toRglLayout(layout, instances, registry, COLS.lg),
      md: toDeviceLayout(layout, instances, registry, COLS.md, deviceLayouts.md),
      sm: toDeviceLayout(layout, instances, registry, COLS.sm, deviceLayouts.sm),
    }),
    [layout, instances, registry, deviceLayouts],
  );

  const children = React.useMemo(
    () =>
      instances.map((instance) => (
        // The wrapping key must equal the LayoutItem `i` (instanceId).
        // data-pb-instance lets the "다른 앱 밀기" prompt anchor to this tile.
        <div
          key={instance.instanceId}
          data-pb-instance={instance.instanceId}
          className="overflow-hidden"
        >
          <CanvasCell
            instance={instance}
            registry={registry}
            actions={renderActions?.(instance)}
            onExpand={
              onFocusInstance
                ? () => onFocusInstance(instance.instanceId)
                : undefined
            }
          />
        </div>
      )),
    [instances, registry, renderActions, onFocusInstance],
  );

  const handleLayoutChange = React.useCallback(
    (current: Layout, all: ResponsiveLayouts<BreakpointKey>) => {
      // Persist the DESKTOP (lg) layout ONLY (§5.4). Two guards (issue ①):
      //  1) Only persist while the ACTIVE breakpoint is lg. At md/sm, RGL clamps
      //     widths to 8/1 cols and would round-trip those clamped widths back
      //     into all.lg — overwriting the real desktop sizes. Skipping non-lg
      //     emissions keeps every existing tile's w/h intact.
      //  2) Drop RGL's transient placeholder (not a real instance).
      if (activeBpRef.current !== "lg") return;
      const source = all.lg ?? current;
      if (!source) return;
      onLayoutChange?.(
        source
          .filter((it) => it.i !== DROPPING_ITEM_ID)
          .map((it) => ({
            instanceId: it.i,
            x: it.x,
            y: it.y,
            w: it.w,
            h: it.h,
          })),
      );
    },
    [onLayoutChange],
  );

  // Drag + resize at EVERY breakpoint now (요구: 모바일에서도 크기조절·이동). On
  // md/sm the edits persist DEVICE-LOCAL (localStorage), so they never clobber the
  // desktop (lg) DB layout. Palette DROP stays desktop-only (touch uses tap-to-add
  // from the FAB sheet); the lg-only DB-push affordances are gated separately.
  const interactive = editable;
  const isLg = activeBp === "lg";
  const droppable = editable && isLg && !!onDropWidget;
  const dropDefault = React.useMemo(
    () => dropItemSize ?? { w: 6, h: 4 }, // v2 default drop size (≈ old 3×2)
    [dropItemSize],
  );

  /* ----------------------- hover-to-fit on drop (②) ----------------------- */
  // The placeholder PROPS stay referentially stable for the whole drag (they
  // always carry the dragged type's default size). The dwell fit is applied two
  // ways instead of by mutating these props mid-drag: (1) onDragOver RETURNS the
  // fitted size, which RGL folds into its drop-centering math each tick; and
  // (2) handleDrop sizes the new widget from the fit authoritatively. Keeping
  // the props constant during a drag is what prevents an RGL render loop
  // (changing droppingItem/dropConfig while its internal dropping node toggles
  // under rapid dragover events cascades setState).
  const dropSize = dropDefault;

  // Dwell bookkeeping (refs → no re-render on every dragover tick).
  const dwellTimerRef = React.useRef<number | null>(null);
  const dwellCellRef = React.useRef<{ x: number; y: number } | null>(null);
  // `pendingFit` is the size onDragOver reports to RGL (and that handleDrop uses
  // for the new widget): the dragged type's default until a dwell fit lands.
  const pendingFitRef = React.useRef<{ w: number; h: number }>(dropDefault);
  // The latest layout + default, read inside the dwell timer (refs avoid
  // re-subscribing the timer on every layout tick). Synced in effects (never
  // written during render — React 19 strict).
  const layoutRef = React.useRef(layout);
  React.useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const dropDefaultRef = React.useRef(dropDefault);
  React.useEffect(() => {
    dropDefaultRef.current = dropDefault;
  }, [dropDefault]);

  const resetDwell = React.useCallback(() => {
    if (dwellTimerRef.current != null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    dwellCellRef.current = null;
    pendingFitRef.current = dropDefaultRef.current;
  }, []);

  // External drop (palette → canvas). RGL gives us the placed LayoutItem (id is
  // the placeholder), so we read the dragged TYPE from the drag-source bridge.
  // The new widget's w/h is the dwell-fitted size (default if no dwell elapsed),
  // so a tile that hovered over a small gap tucks into it (②). x/y come from
  // RGL's placed item. Capture the fit BEFORE resetDwell clears it.
  const handleDrop = React.useCallback(
    (_layout: Layout, item: LayoutItem | undefined) => {
      const type = getDragType();
      const fit = pendingFitRef.current;
      // The cursor cell from the last dragover — where the user ACTUALLY pointed.
      // Prefer it over RGL's placed item so the widget lands where you drop it,
      // not beside the palette (요구: 마우스로 바로 원하는 위치에).
      const cell = dwellCellRef.current;
      clearDragType();
      resetDwell();
      if (!type || !onDropWidget) return;
      const w = fit.w;
      const rawX = cell?.x ?? item?.x ?? 0;
      const rawY = cell?.y ?? item?.y ?? 0;
      const x = Math.min(Math.max(0, rawX), Math.max(0, COLS.lg - w));
      const y = Math.max(0, rawY);
      onDropWidget(type, { x, y, w, h: fit.h });
    },
    [onDropWidget, resetDwell],
  );

  // Cleanup any pending dwell / prompt / auto-push timers on unmount.
  React.useEffect(() => {
    return () => {
      if (dwellTimerRef.current != null)
        window.clearTimeout(dwellTimerRef.current);
      if (promptTimerRef.current != null)
        window.clearTimeout(promptTimerRef.current);
      if (autoPushTimerRef.current != null)
        window.clearTimeout(autoPushTimerRef.current);
      if (dragPushTimerRef.current != null)
        window.clearTimeout(dragPushTimerRef.current);
    };
  }, []);

  const handleDragOver = React.useCallback(
    (e: DragEvent): { w: number; h: number } | false | void => {
      const gridEl = containerRef.current?.querySelector<HTMLElement>(
        ".react-grid-layout",
      );
      if (!gridEl) return pendingFitRef.current;
      const cols = COLS[getBreakpointFromWidth(BREAKPOINTS, width)];
      const positionParams = {
        cols,
        margin: MARGIN,
        maxRows: Infinity,
        rowHeight: ROW_HEIGHT,
        containerWidth: width,
        containerPadding: CONTAINER_PADDING,
      } as const;

      // Which grid CELL is the cursor actually over? Probe with a 1×1 footprint
      // (cursor-centered), independent of the current placeholder's size. Using
      // the full placeholder size here would let RGL's clamping pull the detected
      // cell away from a small gap, so an oversized tile could never discover the
      // gap it should shrink into (②).
      const rect = gridEl.getBoundingClientRect();
      const colWidth = (width - MARGIN[0] * (cols - 1)) / cols;
      const left = Math.max(0, e.clientX - rect.left - colWidth / 2);
      const top = Math.max(0, e.clientY - rect.top - ROW_HEIGHT / 2);
      const { x, y } = calcXY(positionParams, top, left, 1, 1);

      const prev = dwellCellRef.current;
      if (!prev || prev.x !== x || prev.y !== y) {
        // Cell changed → restart the dwell timer; the placeholder reverts to the
        // dragged type's default size until the dwell fit lands again.
        const def0 = dropDefaultRef.current;
        dwellCellRef.current = { x, y };
        pendingFitRef.current = def0;
        if (dwellTimerRef.current != null)
          window.clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = window.setTimeout(() => {
          dwellTimerRef.current = null;
          const cell = dwellCellRef.current;
          if (!cell) return;
          const dragType = getDragType();
          const def = dragType ? registry[dragType] : null;
          const dd = dropDefaultRef.current;
          const bounds = {
            minW: def?.minSize.w ?? 1,
            minH: def?.minSize.h ?? 1,
            maxW: def?.maxSize.w ?? dd.w,
            maxH: Number.isFinite(def?.maxSize.h)
              ? (def?.maxSize.h as number)
              : dd.h,
          };
          const others = layoutRef.current
            .filter((it) => it.instanceId !== DROPPING_ITEM_ID)
            .map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h }));
          const fit = freeFitAt(others, cell.x, cell.y, bounds, cols);
          // Only shrink-to-fit (never grow past the type's default on dwell).
          const next = {
            w: Math.min(fit.w, dd.w),
            h: Math.min(fit.h, dd.h),
          };
          // No-op if the fit equals the default (nothing to tuck into).
          if (next.w === dd.w && next.h === dd.h) return;
          // Record the fitted size. From here, onDragOver returns it so RGL's
          // drop-centering math reflects the smaller tile, and — authoritatively
          // — handleDrop reads pendingFitRef to size the new widget so it tucks
          // into the gap. We deliberately do NOT force RGL to recreate its
          // dropping node (toggling it under rapid dragover events drives a
          // render loop), which keeps the interaction stable.
          pendingFitRef.current = next;
        }, 1000);
      }
      return pendingFitRef.current;
    },
    [containerRef, width, registry],
  );

  // Memoize every config object passed to <Responsive>. RGL re-renders on each
  // internal drag/drop state change; handing it NEW object identities every
  // render churns its config-derived effects (and, with the live drop sizing,
  // can drive a render loop). Stable identities — recomputed only when a real
  // input changes — keep the grid stable.
  const dragConfig = React.useMemo(
    () => ({
      enabled: interactive,
      bounded: false,
      threshold: 4,
      handle: "[data-pb-drag-handle]",
      // The header is the drag handle, but the actions menu lives inside it —
      // cancel drags that start on [data-pb-no-drag] so clicking the ⋮ menu
      // never grabs the tile.
      cancel: "[data-pb-no-drag]",
    }),
    [interactive],
  );
  const resizeConfig = React.useMemo(
    () => ({ enabled: interactive, handles: ["se"] as const }),
    [interactive],
  );
  const dropConfig = React.useMemo(
    () => ({
      enabled: droppable,
      defaultItem: dropSize,
      onDragOver: droppable ? handleDragOver : undefined,
    }),
    [droppable, dropSize, handleDragOver],
  );
  const droppingItem = React.useMemo(
    () => ({ i: DROPPING_ITEM_ID, x: 0, y: 0, w: dropSize.w, h: dropSize.h }),
    [dropSize],
  );

  return (
    // Give the grid surface a tall minimum so there is EMPTY droppable space
    // below the existing tiles — otherwise the grid element is only as tall as
    // its content and a dragged-in widget can only land beside what's already
    // there. With room below, RGL maps the cursor to the row under it, so a new
    // widget drops where you actually point (free placement keeps it from
    // pushing others). Tall boards already exceed this, so it's a floor only.
    <div
      ref={containerRef}
      className="w-full [&_.react-grid-layout]:min-h-[70vh]"
    >
      {mounted ? (
        <Responsive<BreakpointKey>
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={layouts}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={CONTAINER_PADDING}
          // Free placement + a resize-time collision CLAMP (see `compactor`):
          // existing tiles never move on resize/zoom OR when a new tile is
          // dragged in; a resized tile stops at its neighbor instead of
          // overlapping. The "다른 앱 밀기" button then pushes neighbors to fit.
          compactor={compactor}
          // v2 config objects (replaces v1 isDraggable / draggableHandle / isResizable):
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          // v2 drop: enabled + placeholder size; onDragOver supplies the live
          // (dwell-fitted) size. onDrop fires with the placed LayoutItem.
          dropConfig={dropConfig}
          droppingItem={droppingItem}
          onDrop={droppable ? handleDrop : undefined}
          onLayoutChange={handleLayoutChange}
          // Drag tracking: the drag-dwell push-down (lg) + device-local commit (md/sm).
          onDragStart={onDragStart}
          onDrag={onDragTick}
          onDragStop={onDragStop}
          // Resize tracking for the push-to-fit affordance + device-local commit.
          onResizeStart={onResizeStart}
          onResize={onResizeTick}
          onResizeStop={onResizeStop}
        >
          {children}
        </Responsive>
      ) : null}
      {pushPromptId ? (
        <PushPrompt
          containerRef={containerRef}
          instanceId={pushPromptId}
          onConfirm={applyPush}
          onDismiss={clearPushPrompt}
        />
      ) : null}
    </div>
  );
}

export default GridCanvas;
