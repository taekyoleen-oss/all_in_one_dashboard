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
  verticalCompactor,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout";
import type { WidgetRegistry, Density } from "@/lib/widgets/contract";
import { WidgetFrame } from "./WidgetFrame";
import { getDragType, clearDragType } from "@/lib/utils/dragSource";

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
}

/* --------------------------------- config --------------------------------- */

const BREAKPOINTS: Record<BreakpointKey, number> = { lg: 1280, md: 768, sm: 0 };
const COLS: Record<BreakpointKey, number> = { lg: 12, md: 8, sm: 1 };
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
        {/* Keyed by instanceId ⇒ independent state across instances of one type. */}
        <CompactView
          key={instance.instanceId}
          config={instance.config}
          instanceId={instance.instanceId}
          density={density}
        />
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

  // Derive per-breakpoint layouts from the single persisted (lg) layout.
  const layouts = React.useMemo<ResponsiveLayouts<BreakpointKey>>(
    () => ({
      lg: toRglLayout(layout, instances, registry, COLS.lg),
      md: toRglLayout(layout, instances, registry, COLS.md),
      sm: toRglLayout(layout, instances, registry, COLS.sm),
    }),
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
      // Persist the DESKTOP layout only (§5.4): mobile (sm) is auto-derived as a
      // 1-col stack and is not saved. Fall back to the active layout if lg is
      // not yet populated (e.g. first render at a smaller breakpoint).
      const source = all.lg ?? current;
      onLayoutChange?.(
        source
          // Ignore RGL's transient drop placeholder (it is not a real instance).
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

  // External drop (palette → canvas). RGL gives us the placed LayoutItem (id is
  // the placeholder), so we read the dragged TYPE from the drag-source bridge.
  const handleDrop = React.useCallback(
    (_layout: Layout, item: LayoutItem | undefined) => {
      const type = getDragType();
      clearDragType();
      if (!type || !item || !onDropWidget) return;
      onDropWidget(type, { x: item.x, y: item.y, w: item.w, h: item.h });
    },
    [onDropWidget],
  );

  const droppable = editable && !!onDropWidget;
  const dropDefault = dropItemSize ?? { w: 3, h: 2 };

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
          compactor={verticalCompactor}
          // v2 config objects (replaces v1 isDraggable / draggableHandle / isResizable):
          dragConfig={{
            enabled: editable,
            bounded: false,
            threshold: 4,
            handle: "[data-pb-drag-handle]",
            // The header is the drag handle, but the actions menu lives inside
            // it — cancel drags that start on [data-pb-no-drag] so clicking the
            // ⋮ menu never grabs the tile.
            cancel: "[data-pb-no-drag]",
          }}
          resizeConfig={{ enabled: editable, handles: ["se"] }}
          // v2 drop: enabled + the placeholder size; onDrop fires with the placed
          // LayoutItem. droppingItem keeps the placeholder id stable + sized.
          dropConfig={{ enabled: droppable, defaultItem: dropDefault }}
          droppingItem={{
            i: DROPPING_ITEM_ID,
            x: 0,
            y: 0,
            w: dropDefault.w,
            h: dropDefault.h,
          }}
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
