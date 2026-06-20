"use client";

/**
 * ============================================================================
 *  WidgetPalette — available widget types (설계서 §3 팔레트, §6.2 반응형)
 * ============================================================================
 *
 *  Desktop (≥768): a FLOATING, MOVABLE overlay panel (position: fixed, high
 *  z-index). It is rendered OUTSIDE the document flow, so opening/closing/moving
 *  it NEVER changes the canvas container width — the GridCanvas stays full-width
 *  and stable, so placed widgets never shift (issue ⑧/①). The panel:
 *    • opens/closes from the Toolbar 팔레트 toggle (and its own close ✕);
 *    • drags by its header (pointer drag, clamped to the viewport);
 *    • persists its open state + position in localStorage (survives reloads).
 *
 *  Mobile  (<768): a bottom SHEET opened by a floating `+` FAB. The sheet uses
 *  the shared Back-Stack guard (useBackStack) keyed `palette:sheet`, so Android /
 *  PWA Back closes the sheet instead of the app (§6.3). Unchanged.
 *
 *  Add-to-canvas, two ways (both per spec §3):
 *    • DRAG — each item is HTML5-`draggable`; on dragstart it records its type in
 *      the drag-source bridge (lib/utils/dragSource). GridCanvas reads it in
 *      onDrop and creates the instance at the dropped grid position.
 *    • TAP  — click/tap appends an instance (placed below existing content).
 *      Tapping inside the mobile sheet also closes the sheet.
 *
 *  This component is presentation + intent only: it calls `onAdd(type)` and lets
 *  the page mint/append the instance (single source of truth for board state).
 * ============================================================================
 */

import * as React from "react";
import { Plus, X, GripVertical, LayoutGrid } from "lucide-react";
import type { WidgetRegistry, WidgetDefinition } from "@/lib/widgets/contract";
import { IconButton } from "@/components/ui/primitives";
import { useBackStack } from "@/lib/utils/useBackStack";
import { setDragType, clearDragType } from "@/lib/utils/dragSource";

const COLLAPSE_KEY = "pb:palette:collapsed";
const POSITION_KEY = "pb:palette:pos";
const SHEET_ID = "palette:sheet";

/** Floating-panel geometry (desktop). Used for default placement + viewport clamping. */
const PANEL_WIDTH = 240; // px (matches md:w-60)
const PANEL_MARGIN = 16; // keep-on-screen padding from each viewport edge
const DEFAULT_POS: PalettePosition = { x: 16, y: 96 };

export interface PalettePosition {
  x: number;
  y: number;
}

export interface WidgetPaletteProps {
  registry: WidgetRegistry;
  /** Tap-to-add: append a fresh instance of `type`. */
  onAdd: (type: string) => void;
  /**
   * Controlled "closed" state (desktop). `true` ⇒ the floating panel is hidden.
   * Lifted so the Toolbar 팔레트 toggle can also open/close it. (Name kept as
   * `collapsed` for call-site stability; semantically: closed = collapsed.)
   */
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
}

/* ----------------------------- shared list UI ----------------------------- */

function defList(registry: WidgetRegistry): WidgetDefinition[] {
  // Stable order: core widgets first, then extended; alpha within each group.
  return Object.values(registry).sort((a, b) => {
    if (a.category !== b.category) return a.category === "core" ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, "ko");
  });
}

function PaletteItem({
  def,
  onAdd,
  mode,
}: {
  def: WidgetDefinition;
  onAdd: (type: string) => void;
  /** Desktop palette adds on DOUBLE-click (avoids accidental single-click adds);
   *  the mobile sheet adds on a single tap. Drag-to-canvas works in both. */
  mode: "click" | "doubleClick";
}) {
  const Icon = typeof def.icon === "string" ? null : def.icon;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        setDragType(def.type);
        // Some browsers require data for a drag to initiate.
        e.dataTransfer.setData("text/plain", def.type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={() => clearDragType()}
      onClick={mode === "click" ? () => onAdd(def.type) : undefined}
      onDoubleClick={
        mode === "doubleClick" ? () => onAdd(def.type) : undefined
      }
      title={
        mode === "doubleClick"
          ? "더블클릭하여 추가 · 드래그하여 캔버스에 배치"
          : "탭하여 추가 · 드래그하여 배치"
      }
      className={[
        "group/item flex w-full items-center gap-2 rounded-md border border-border bg-card",
        "px-2.5 py-2 text-left text-sm text-card-foreground outline-none",
        "cursor-grab transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
      ].join(" ")}
    >
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        {Icon ? <Icon size={16} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{def.displayName}</span>
      <GripVertical
        size={14}
        className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover/item:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function PaletteList({
  registry,
  onAdd,
  mode,
}: {
  registry: WidgetRegistry;
  onAdd: (type: string) => void;
  mode: "click" | "doubleClick";
}) {
  const defs = React.useMemo(() => defList(registry), [registry]);
  return (
    <div className="flex flex-col gap-1.5">
      {defs.map((def) => (
        <PaletteItem key={def.type} def={def} onAdd={onAdd} mode={mode} />
      ))}
    </div>
  );
}

/* --------------------- floating panel drag (desktop) ---------------------- */

/** Clamp a panel position so the panel stays within the viewport. */
function clampPosition(
  pos: PalettePosition,
  panelEl: HTMLElement | null,
): PalettePosition {
  if (typeof window === "undefined") return pos;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = panelEl?.offsetWidth ?? PANEL_WIDTH;
  const h = panelEl?.offsetHeight ?? 320;
  const maxX = Math.max(PANEL_MARGIN, vw - w - PANEL_MARGIN);
  const maxY = Math.max(PANEL_MARGIN, vh - h - PANEL_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, PANEL_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, PANEL_MARGIN), maxY),
  };
}

/* ------------------------------- main export ------------------------------ */

export function WidgetPalette({
  registry,
  onAdd,
  collapsed,
  onCollapsedChange,
}: WidgetPaletteProps) {
  const { isOpen, openOverlay, closeTop } = useBackStack();
  const sheetOpen = isOpen(SHEET_ID);

  const [position, setPosition] = usePalettePosition();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  // Live pointer-drag bookkeeping (kept in a ref → no re-render per move).
  const dragRef = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const onHeaderPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Ignore drags that start on an interactive control (the close button).
      if ((e.target as HTMLElement).closest("[data-pb-no-drag]")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      dragRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      // Capture so the drag keeps tracking even if the pointer leaves the header.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer (e.g. synthetic event) — drag still works via move */
      }
      e.preventDefault();
    },
    [],
  );

  const onHeaderPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const next = clampPosition(
        { x: e.clientX - drag.offsetX, y: e.clientY - drag.offsetY },
        panelRef.current,
      );
      setPosition(next);
    },
    [setPosition],
  );

  const endDrag = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be lost */
      }
    },
    [],
  );

  // Re-clamp the panel into view on viewport resize (so it never strands offscreen).
  React.useEffect(() => {
    if (collapsed) return;
    function onResize() {
      setPosition((prev) => clampPosition(prev, panelRef.current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed, setPosition]);

  return (
    <>
      {/* ---------- Desktop: floating, movable overlay panel (≥768) ---------- */}
      {/* Rendered OUTSIDE document flow ⇒ canvas width is unaffected by it. */}
      {!collapsed && (
        <aside
          ref={panelRef}
          aria-label="위젯 팔레트"
          style={{ left: position.x, top: position.y, width: PANEL_WIDTH }}
          className={[
            "hidden md:flex md:flex-col",
            "fixed z-40 max-h-[min(70dvh,32rem)]",
            "rounded-[var(--radius)] border border-border bg-card text-card-foreground",
            "shadow-2xl ring-1 ring-black/5",
            "motion-safe:animate-[pb-overlay-in_160ms_ease-out]",
          ].join(" ")}
        >
          {/* Header = drag handle. touch-none so pointer drags aren't hijacked
              by the browser's scroll/gesture on touch-capable desktops. */}
          <header
            onPointerDown={onHeaderPointerDown}
            onPointerMove={onHeaderPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={[
              "flex shrink-0 cursor-grab touch-none select-none items-center gap-2",
              "rounded-t-[var(--radius)] border-b border-border px-2.5 py-2",
              "active:cursor-grabbing",
            ].join(" ")}
          >
            <GripVertical
              size={14}
              className="shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              위젯
            </span>
            <span data-pb-no-drag>
              <IconButton
                label="팔레트 닫기"
                onClick={() => onCollapsedChange(true)}
              >
                <X size={16} />
              </IconButton>
            </span>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <PaletteList registry={registry} onAdd={onAdd} mode="doubleClick" />
          </div>
        </aside>
      )}

      {/* Desktop: a small re-open affordance when the panel is closed, so the
          palette is reachable even if the Toolbar is hidden. */}
      {collapsed && (
        <button
          type="button"
          aria-label="위젯 팔레트 열기"
          onClick={() => onCollapsedChange(false)}
          className={[
            "hidden md:inline-flex fixed bottom-5 left-5 z-40 size-11 items-center justify-center",
            "rounded-full border border-border bg-card text-card-foreground shadow-lg outline-none",
            "transition-transform hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
          ].join(" ")}
        >
          <LayoutGrid size={18} />
        </button>
      )}

      {/* ---------- Mobile: FAB + bottom sheet (<768) ---------- */}
      <button
        type="button"
        aria-label="위젯 추가"
        onClick={() => openOverlay(SHEET_ID)}
        className={[
          "md:hidden fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center",
          "rounded-full bg-primary text-primary-foreground shadow-lg outline-none",
          "transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
        ].join(" ")}
      >
        <Plus size={24} />
      </button>

      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Scrim — tap closes the top overlay (the sheet). */}
          <button
            type="button"
            aria-label="닫기"
            onClick={closeTop}
            className="absolute inset-0 bg-black/50 motion-safe:transition-opacity"
          />
          {/* Sheet panel — slides up from the bottom. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="위젯 추가"
            className={[
              "absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-hidden rounded-t-2xl",
              "border-t border-border bg-card text-card-foreground shadow-2xl",
              "motion-safe:animate-[pb-sheet-up_240ms_ease-out]",
            ].join(" ")}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">위젯 추가</h2>
              <IconButton label="닫기" onClick={closeTop}>
                <X size={18} />
              </IconButton>
            </div>
            {/* Grab affordance */}
            <div className="mx-auto -mt-1 mb-1 h-1 w-10 rounded-full bg-border" />
            <div className="max-h-[60dvh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <PaletteList
                registry={registry}
                mode="click"
                onAdd={(type) => {
                  onAdd(type);
                  closeTop(); // tap-add closes the sheet
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------- persisted open/closed flag (hook) ------------------ */
/**
 * `usePaletteCollapsed` exposes the desktop palette's closed flag backed by
 * localStorage, via `useSyncExternalStore` — so it reads the persisted value on
 * the client WITHOUT a setState-in-effect, and SSR-safely renders the default
 * (false = OPEN). A module-level listener set lets the writer notify all
 * subscribers (and `storage` events sync across tabs).
 */
let collapsedListeners: Set<() => void> | null = null;

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  collapsedListeners?.forEach((l) => l());
}

function subscribeCollapsed(listener: () => void): () => void {
  if (!collapsedListeners) collapsedListeners = new Set();
  collapsedListeners.add(listener);
  // Cross-tab sync: a write in another tab fires `storage` here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLLAPSE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    collapsedListeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePaletteCollapsed(): readonly [boolean, (next: boolean) => void] {
  const collapsed = React.useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false, // server snapshot — always open during SSR
  );
  const setCollapsed = React.useCallback((next: boolean) => {
    writeCollapsed(next);
  }, []);
  return [collapsed, setCollapsed];
}

/* --------------------- persisted panel position (hook) -------------------- */
/**
 * Same useSyncExternalStore pattern for the floating panel's {x,y}. SSR renders
 * the default position; the client hydrates the persisted value with no
 * setState-in-effect. Writes accept a value OR an updater (so a resize handler
 * can re-clamp against the latest position).
 */
let positionListeners: Set<() => void> | null = null;
let positionCache: PalettePosition | null = null; // memoized snapshot (referential stability)

function readPosition(): PalettePosition {
  if (typeof window === "undefined") return DEFAULT_POS;
  if (positionCache) return positionCache;
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PalettePosition>;
      if (
        typeof parsed?.x === "number" &&
        Number.isFinite(parsed.x) &&
        typeof parsed?.y === "number" &&
        Number.isFinite(parsed.y)
      ) {
        positionCache = { x: parsed.x, y: parsed.y };
        return positionCache;
      }
    }
  } catch {
    /* fall through to default */
  }
  positionCache = computeDefaultPos();
  return positionCache;
}

/** Default to the TOP-RIGHT so the floating panel never covers the first
 *  (top-left) widget tile — otherwise it would block dragging that tile (⑨). */
function computeDefaultPos(): PalettePosition {
  if (typeof window === "undefined") return DEFAULT_POS;
  return {
    x: Math.max(PANEL_MARGIN, window.innerWidth - PANEL_WIDTH - PANEL_MARGIN),
    y: 96,
  };
}

function writePosition(value: PalettePosition): void {
  positionCache = value; // update the snapshot first so getSnapshot is stable
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  positionListeners?.forEach((l) => l());
}

function subscribePosition(listener: () => void): () => void {
  if (!positionListeners) positionListeners = new Set();
  positionListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === POSITION_KEY) {
      positionCache = null; // invalidate so the next read re-parses
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    positionListeners?.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePalettePosition(): readonly [
  PalettePosition,
  (next: PalettePosition | ((prev: PalettePosition) => PalettePosition)) => void,
] {
  const position = React.useSyncExternalStore(
    subscribePosition,
    readPosition,
    () => DEFAULT_POS, // server snapshot
  );
  const setPosition = React.useCallback(
    (
      next:
        | PalettePosition
        | ((prev: PalettePosition) => PalettePosition),
    ) => {
      const resolved =
        typeof next === "function" ? next(readPosition()) : next;
      writePosition(resolved);
    },
    [],
  );
  return [position, setPosition];
}

export default WidgetPalette;
