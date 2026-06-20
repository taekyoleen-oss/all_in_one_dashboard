"use client";

/**
 * ============================================================================
 *  WidgetPalette — available widget types (설계서 §3 팔레트, §6.2 반응형)
 * ============================================================================
 *
 *  Desktop (≥768): a collapsible LEFT sidebar. Collapsing frees the canvas to
 *  full width; the collapsed flag is persisted in localStorage.
 *
 *  Mobile  (<768): a bottom SHEET opened by a floating `+` FAB. The sheet uses
 *  the shared Back-Stack guard (useBackStack) keyed `palette:sheet`, so Android /
 *  PWA Back closes the sheet instead of the app (§6.3).
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
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
  GripVertical,
} from "lucide-react";
import type { WidgetRegistry, WidgetDefinition } from "@/lib/widgets/contract";
import { IconButton } from "@/components/ui/primitives";
import { useBackStack } from "@/lib/utils/useBackStack";
import { setDragType, clearDragType } from "@/lib/utils/dragSource";

const COLLAPSE_KEY = "pb:palette:collapsed";
const SHEET_ID = "palette:sheet";

export interface WidgetPaletteProps {
  registry: WidgetRegistry;
  /** Tap-to-add: append a fresh instance of `type`. */
  onAdd: (type: string) => void;
  /** Controlled collapsed state (desktop). Lifted so Toolbar can also toggle it. */
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
}: {
  def: WidgetDefinition;
  onAdd: (type: string) => void;
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
      onClick={() => onAdd(def.type)}
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
}: {
  registry: WidgetRegistry;
  onAdd: (type: string) => void;
}) {
  const defs = React.useMemo(() => defList(registry), [registry]);
  return (
    <div className="flex flex-col gap-1.5">
      {defs.map((def) => (
        <PaletteItem key={def.type} def={def} onAdd={onAdd} />
      ))}
    </div>
  );
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

  return (
    <>
      {/* ---------- Desktop: collapsible left sidebar (≥768) ---------- */}
      <aside
        aria-label="위젯 팔레트"
        className={[
          "hidden md:flex md:flex-col md:shrink-0 md:self-start",
          "md:sticky md:top-4 md:max-h-[calc(100dvh-2rem)]",
          "rounded-[var(--radius)] border border-border bg-card/40",
          "transition-[width] duration-200",
          collapsed ? "md:w-12" : "md:w-60",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-2">
          {!collapsed && (
            <span className="truncate px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              위젯
            </span>
          )}
          <IconButton
            label={collapsed ? "팔레트 펼치기" : "팔레트 접기"}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </IconButton>
        </div>
        {!collapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <PaletteList registry={registry} onAdd={onAdd} />
          </div>
        )}
      </aside>

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

/* --------------------- persisted collapsed flag (hook) -------------------- */
/**
 * `usePaletteCollapsed` exposes the desktop palette's collapsed flag backed by
 * localStorage, via `useSyncExternalStore` — so it reads the persisted value on
 * the client WITHOUT a setState-in-effect, and SSR-safely renders the default
 * (false = expanded). A module-level listener set lets the writer notify all
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
    () => false, // server snapshot — always expanded during SSR
  );
  const setCollapsed = React.useCallback((next: boolean) => {
    writeCollapsed(next);
  }, []);
  return [collapsed, setCollapsed];
}

export default WidgetPalette;
