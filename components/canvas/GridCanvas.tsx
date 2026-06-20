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
 *  Breakpoints (§6.2): lg ≥1280 (12col) / md ≥768 (8col) / sm <768 (1col stack).
 *  Each widget instance is rendered through a registry lookup and keyed by its
 *  `instanceId`, so two instances of the same type hold **independent** state.
 */

import * as React from "react";
import {
  Responsive,
  useContainerWidth,
  noCompactor,
  getBreakpointFromWidth,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { calcXY } from "react-grid-layout";
import type { WidgetRegistry, Density } from "@/lib/widgets/contract";
import { WidgetFrame } from "./WidgetFrame";
import { getDragType, clearDragType } from "@/lib/utils/dragSource";
import { usePersistedFontScale } from "@/lib/utils/fontScale";

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

export type BreakpointKey = "lg";

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
}

/* --------------------------------- config --------------------------------- */

// Single fixed breakpoint (always active at width ≥ 0). The canvas no longer
// switches column counts on resize/zoom: the column WIDTH flexes with the
// container, but every tile keeps its grid x/y/w/h, so positions & structure
// never change (요구: 화면 축소·확대 시 위치 불변). The 재정렬 button is the only
// thing that re-packs the layout (verticalCompactor, in CanvasShell).
const BREAKPOINTS: Record<BreakpointKey, number> = { lg: 0 };
const COLS: Record<BreakpointKey, number> = { lg: 12 };
const ROW_HEIGHT = 96;
const MARGIN: [number, number] = [12, 12];
const CONTAINER_PADDING: [number, number] = [0, 0];
/** RGL v2's external-drop placeholder id (must match its internal default). */
const DROPPING_ITEM_ID = "__dropping-elem__";

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
}: {
  instance: WidgetInstance;
  registry: WidgetRegistry;
  actions?: React.ReactNode;
}) {
  const cellRef = React.useRef<HTMLDivElement | null>(null);
  const [density, setDensity] = React.useState<Density>("cozy");
  // Per-instance 글자 크기 (zoom factor). The ⋮-menu control writes the same key,
  // so the tile re-scales live. Density (above) is measured on the UNZOOMED cell,
  // so the reflow bucket stays correct regardless of font scale.
  const { scale } = usePersistedFontScale(instance.instanceId);

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
      <WidgetFrame title={displayName} icon={icon} actions={actions}>
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

  // Derive per-breakpoint layouts from the single persisted (lg) layout.
  const layouts = React.useMemo<ResponsiveLayouts<BreakpointKey>>(
    () => ({ lg: toRglLayout(layout, instances, registry, COLS.lg) }),
    [layout, instances, registry],
  );

  const children = React.useMemo(
    () =>
      instances.map((instance) => (
        // The wrapping key must equal the LayoutItem `i` (instanceId).
        <div key={instance.instanceId} className="overflow-hidden">
          <CanvasCell
            instance={instance}
            registry={registry}
            actions={renderActions?.(instance)}
          />
        </div>
      )),
    [instances, registry, renderActions],
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

  const droppable = editable && !!onDropWidget;
  const dropDefault = React.useMemo(
    () => dropItemSize ?? { w: 3, h: 2 },
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
      clearDragType();
      resetDwell();
      if (!type || !item || !onDropWidget) return;
      onDropWidget(type, { x: item.x, y: item.y, w: fit.w, h: fit.h });
    },
    [onDropWidget, resetDwell],
  );

  // Cleanup any pending dwell timer on unmount.
  React.useEffect(() => {
    return () => {
      if (dwellTimerRef.current != null)
        window.clearTimeout(dwellTimerRef.current);
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
      enabled: editable,
      bounded: false,
      threshold: 4,
      handle: "[data-pb-drag-handle]",
      // The header is the drag handle, but the actions menu lives inside it —
      // cancel drags that start on [data-pb-no-drag] so clicking the ⋮ menu
      // never grabs the tile.
      cancel: "[data-pb-no-drag]",
    }),
    [editable],
  );
  const resizeConfig = React.useMemo(
    () => ({ enabled: editable, handles: ["se"] as const }),
    [editable],
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
    <div ref={containerRef} className="w-full">
      {mounted ? (
        <Responsive<BreakpointKey>
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={layouts}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={CONTAINER_PADDING}
          // Free placement: tiles never auto-move (no float-up), so resize/zoom
          // and dropping a new tile leave existing tiles exactly where the user
          // put them. The 재정렬(정리하기) button applies vertical compaction.
          compactor={noCompactor}
          // v2 config objects (replaces v1 isDraggable / draggableHandle / isResizable):
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          // v2 drop: enabled + placeholder size; onDragOver supplies the live
          // (dwell-fitted) size. onDrop fires with the placed LayoutItem.
          dropConfig={dropConfig}
          droppingItem={droppingItem}
          onDrop={droppable ? handleDrop : undefined}
          onLayoutChange={handleLayoutChange}
        >
          {children}
        </Responsive>
      ) : null}
    </div>
  );
}

export default GridCanvas;
