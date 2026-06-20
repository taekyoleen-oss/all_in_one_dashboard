"use client";

/**
 * ============================================================================
 *  CanvasShell (Phase 2-C) — the interactive canvas, now DB-backed.
 * ============================================================================
 *
 *  Auth is gated in app/page.tsx (Server Component). That page now ALSO loads the
 *  user's boards + widgets from Supabase (lib/supabase/queries/boards.ts) and
 *  passes them here as `initialBoards`, with the verified `userId`. All canvas
 *  state lives in the `usePersistence` hook, which mirrors every mutation to
 *  Supabase (RLS-gated to auth.uid()) — optimistic + debounced batched upsert,
 *  desktop-only layout, failure → toast/retry/local-draft (설계서 §5.4).
 *
 *  Shell features (unchanged from Phase 2-B):
 *    • BoardTabs    — switch / add / rename / delete / set-default (persisted)
 *    • WidgetPalette — collapsible sidebar + mobile FAB/sheet; add by DRAG + TAP
 *    • Toolbar      — edit/lock toggle, 정리하기, palette show/hide, theme toggle
 *    • GridCanvas   — move/resize (honors lock), per-widget ⋮ menu in the header
 *    • FocusOverlay — 자세히 full-screen ExpandedView; Back closes focus only
 *    • ConfigDialog — 편집 hosts the widget's ConfigEditor
 *    • clipboard    — 복사/붙여넣기 of { type, config } → a NEW pb_widgets row
 *    • AccountMenu  — bottom-left, shows signed-in email + 로그아웃
 *
 *  The whole tree is wrapped in <ToastProvider> so persistence failures can
 *  surface a toast with a 다시 시도 action.
 * ============================================================================
 */

import * as React from "react";
import {
  GridCanvas,
  type CanvasLayoutItem,
  type WidgetInstance,
} from "@/components/canvas/GridCanvas";
import {
  WidgetPalette,
  usePaletteCollapsed,
} from "@/components/canvas/WidgetPalette";
import { BoardTabs } from "@/components/canvas/BoardTabs";
import { Toolbar } from "@/components/canvas/Toolbar";
import { FocusOverlay } from "@/components/canvas/FocusOverlay";
import { ConfigDialog } from "@/components/canvas/ConfigDialog";
import { WidgetMenu } from "@/components/canvas/WidgetMenu";
import { AccountMenu } from "@/components/canvas/AccountMenu";
import { ToastProvider } from "@/components/ui/Toaster";
import { widgetRegistry } from "@/components/widgets/registry";
import { useBackStack } from "@/lib/utils/useBackStack";
import { useClipboard } from "@/lib/utils/clipboard";
import { createInstance } from "@/lib/utils/grid";
import { usePersistedTheme } from "@/lib/utils/theme";
import { usePersistence } from "@/lib/persistence/usePersistence";
import type { BoardState } from "@/lib/persistence/types";
import { verticalCompactor, type Layout } from "react-grid-layout";

const LG_COLS = 12;

/** True iff `layout` describes exactly the instances in `instances` (same ids). */
function sameInstanceSet(
  instances: WidgetInstance[],
  layout: CanvasLayoutItem[],
): boolean {
  if (instances.length !== layout.length) return false;
  const ids = new Set(instances.map((i) => i.instanceId));
  for (const it of layout) if (!ids.has(it.instanceId)) return false;
  return true;
}

/** Order-independent deep equality for two canvas layouts (echo-loop guard). */
function layoutsEqual(a: CanvasLayoutItem[], b: CanvasLayoutItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((it) => [it.instanceId, it]));
  for (const it of b) {
    const m = byId.get(it.instanceId);
    if (!m || m.x !== it.x || m.y !== it.y || m.w !== it.w || m.h !== it.h)
      return false;
  }
  return true;
}

/** Run a layout through the vertical compactor (정리하기). */
function compactLayout(layout: CanvasLayoutItem[]): CanvasLayoutItem[] {
  const rgl: Layout = layout.map((it) => ({
    i: it.instanceId,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
  }));
  const compacted = verticalCompactor.compact(rgl, LG_COLS);
  return compacted.map((it) => ({
    instanceId: it.i,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
  }));
}

/* --------------------------------- shell ---------------------------------- */

export interface CanvasShellProps {
  /** Signed-in owner email (from the verified server session). */
  userEmail: string | null;
  /** Verified user id (auth.uid()) — set on every persisted row. */
  userId: string;
  /** Boards + widgets loaded server-side (RLS-scoped). Bootstrapped on first login. */
  initialBoards: BoardState[];
}

/**
 * Outer shell: establishes the ToastProvider so the persistence hook (which uses
 * useToast) can run inside it. The interactive body lives in <CanvasBody>.
 */
export function CanvasShell({
  userEmail,
  userId,
  initialBoards,
}: CanvasShellProps) {
  return (
    <ToastProvider>
      <CanvasBody
        userEmail={userEmail}
        userId={userId}
        initialBoards={initialBoards}
      />
    </ToastProvider>
  );
}

function CanvasBody({ userEmail, userId, initialBoards }: CanvasShellProps) {
  const persistence = usePersistence(initialBoards, userId);
  const {
    boards,
    activeId,
    active,
    setActiveId,
    updateActiveLayout,
    addInstance,
    deleteInstance,
    saveConfig,
    compactActive,
    addBoard,
    renameBoard,
    deleteBoard,
    setDefaultBoard,
    reorderBoards,
  } = persistence;

  const [editable, setEditable] = React.useState(true);
  // Theme persists across reloads (localStorage). data-theme is also set pre-paint
  // by an inline script in app/layout.tsx so there is no flash on load.
  const [theme, setTheme] = usePersistedTheme();
  // Desktop palette collapsed flag — persisted in localStorage (SSR-safe hook).
  const [paletteCollapsed, setCollapsed] = usePaletteCollapsed();

  // Overlay ids edited/focused: track WHICH instance each overlay targets.
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  const { openOverlay, closeTop, isOpen } = useBackStack();
  const clipboard = useClipboard();

  // Apply theme to <html data-theme> (tokens key off :root[data-theme]).
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* ----- layout change from the canvas (move/resize) ----- */
  const handleLayoutChange = React.useCallback(
    (next: CanvasLayoutItem[]) => {
      // react-grid-layout (controlled `layouts`) emits TRANSIENT, incomplete
      // layouts right after a drop — it momentarily reports a layout missing the
      // just-added instance, then one with it. Two guards stop the echo loop:
      //  1) Reject any emission whose instance-id SET ≠ the active board's set.
      //  2) No-op when the (matching) layout is unchanged (no new array identity).
      if (!sameInstanceSet(active.instances, next)) return;
      if (layoutsEqual(active.layout, next)) return;
      updateActiveLayout(next);
    },
    [active.instances, active.layout, updateActiveLayout],
  );

  /* ----- add a fresh instance by TYPE (tap) ----- */
  const addByType = React.useCallback(
    (type: string) => {
      const created = createInstance(widgetRegistry, type, {
        existingLayout: active.layout,
      });
      if (!created) return;
      addInstance(created.instance, created.layoutItem);
    },
    [active.layout, addInstance],
  );

  /* ----- add an instance by DROP (RGL gives the x/y + dwell-fitted w/h) ----- */
  const addByDrop = React.useCallback(
    (type: string, placement: { x: number; y: number; w: number; h: number }) => {
      // Honor RGL's dropped x/y AND the (dwell-fitted) w/h so a tile that tucked
      // into a small gap keeps that fitted size (issue ②). createInstance clamps
      // w/h to the widget's min/max.
      const def = widgetRegistry[type];
      const min = def?.minSize ?? { w: 1, h: 1 };
      const max = def?.maxSize ?? { w: LG_COLS, h: Infinity };
      const created = createInstance(widgetRegistry, type, {
        placement: {
          x: placement.x,
          y: placement.y,
          w: Math.min(Math.max(placement.w, min.w), max.w),
          h: Math.min(Math.max(placement.h, min.h), max.h),
        },
      });
      if (!created) return;
      addInstance(created.instance, created.layoutItem);
    },
    [addInstance],
  );

  /* ----- per-instance menu actions ----- */
  const copyInstance = React.useCallback(
    (instanceId: string) => {
      const inst = active.instances.find((i) => i.instanceId === instanceId);
      if (inst) clipboard.copy({ type: inst.type, config: inst.config });
    },
    [active, clipboard],
  );

  const pasteFromClipboard = React.useCallback(() => {
    const payload = clipboard.read();
    if (!payload) return;
    // 붙여넣기 mints a NEW instance (new uuid) → a NEW pb_widgets row.
    const created = createInstance(widgetRegistry, payload.type, {
      config: payload.config,
      existingLayout: active.layout,
    });
    if (!created) return;
    addInstance(created.instance, created.layoutItem);
  }, [clipboard, active.layout, addInstance]);

  const openFocus = React.useCallback(
    (instanceId: string) => {
      setFocusId(instanceId);
      openOverlay(`focus:${instanceId}`);
    },
    [openOverlay],
  );

  const openEdit = React.useCallback(
    (instanceId: string) => {
      setEditId(instanceId);
      openOverlay(`edit:${instanceId}`);
    },
    [openOverlay],
  );

  const compactActiveBoard = React.useCallback(() => {
    compactActive(compactLayout);
  }, [compactActive]);

  /* ----- render-prop: per-instance widget menu in the frame header ----- */
  const renderActions = React.useCallback(
    (instance: WidgetInstance) => (
      <WidgetMenu
        instanceId={instance.instanceId}
        onCopy={() => copyInstance(instance.instanceId)}
        onPaste={pasteFromClipboard}
        canPaste={clipboard.hasContent}
        onDelete={() => deleteInstance(instance.instanceId)}
        onFocus={() => openFocus(instance.instanceId)}
        onEdit={() => openEdit(instance.instanceId)}
      />
    ),
    [
      copyInstance,
      pasteFromClipboard,
      clipboard.hasContent,
      deleteInstance,
      openFocus,
      openEdit,
    ],
  );

  /* ----- overlay target resolution (focus/edit close when stack pops) ----- */
  const focusOpen = focusId != null && isOpen(`focus:${focusId}`);
  const editOpen = editId != null && isOpen(`edit:${editId}`);
  const focusInstance =
    focusId != null
      ? (active.instances.find((i) => i.instanceId === focusId) ?? null)
      : null;
  const editInstance = editOpen
    ? (active.instances.find((i) => i.instanceId === editId) ?? null)
    : null;

  return (
    <main className="min-h-dvh bg-background">
      {/* Sticky header: title + board tabs + toolbar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              PaneBoard
            </h1>
            <Toolbar
              editable={editable}
              onToggleEditable={() => setEditable((v) => !v)}
              onCompact={compactActiveBoard}
              paletteCollapsed={paletteCollapsed}
              onTogglePalette={() => setCollapsed(!paletteCollapsed)}
              theme={theme}
              onToggleTheme={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
            />
          </div>
          <BoardTabs
            boards={boards.map((b) => ({
              id: b.meta.id,
              name: b.meta.name,
              isDefault: b.meta.isDefault,
            }))}
            activeId={activeId}
            onSelect={setActiveId}
            onAddBoard={addBoard}
            onRenameBoard={renameBoard}
            onDeleteBoard={deleteBoard}
            onSetDefaultBoard={setDefaultBoard}
            onReorder={reorderBoards}
          />
        </div>
      </div>

      {/*
        Body: full-width canvas. The palette is a FLOATING overlay (position:
        fixed) rendered OUTSIDE this flow, so toggling/moving it never changes the
        canvas's measured width — placed widgets stay put (issue ⑧/①).
      */}
      <WidgetPalette
        registry={widgetRegistry}
        onAdd={addByType}
        collapsed={paletteCollapsed}
        onCollapsedChange={setCollapsed}
      />

      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="min-w-0">
          {active.instances.length === 0 ? (
            <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border text-center">
              <p className="text-sm font-medium text-foreground">
                빈 보드입니다
              </p>
              <p className="text-xs text-muted-foreground">
                팔레트에서 위젯을 끌어다 놓거나 탭해서 추가하세요.
              </p>
            </div>
          ) : (
            <GridCanvas
              registry={widgetRegistry}
              instances={active.instances}
              layout={active.layout}
              onLayoutChange={handleLayoutChange}
              editable={editable}
              onDropWidget={addByDrop}
              renderActions={renderActions}
            />
          )}
        </section>
      </div>

      {/* Account control — bottom-left avatar → email + 로그아웃 */}
      <AccountMenu email={userEmail} />

      {/* Overlays — share ONE back-stack LIFO with the mobile palette sheet. */}
      <FocusOverlay
        registry={widgetRegistry}
        instance={focusInstance}
        open={focusOpen}
        onClose={closeTop}
      />
      <ConfigDialog
        registry={widgetRegistry}
        instance={editInstance}
        open={editOpen}
        onSave={saveConfig}
        onClose={closeTop}
      />
    </main>
  );
}

export default CanvasShell;
