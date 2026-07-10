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
import { requestRename } from "@/lib/utils/widgetTitle";
import { AccountMenu } from "@/components/canvas/AccountMenu";
import { SettingsDialog } from "@/components/canvas/SettingsDialog";
import { BrandMark } from "@/components/brand/BrandMark";
import { ToastProvider } from "@/components/ui/Toaster";
import { widgetRegistry } from "@/components/widgets/registry";
import { useHiddenWidgets } from "@/lib/utils/paletteVisibility";
import type { WidgetRegistry } from "@/lib/widgets/contract";
import { useBackStack } from "@/lib/utils/useBackStack";
import { useClipboard } from "@/lib/utils/clipboard";
import { createInstance } from "@/lib/utils/grid";
import { usePersistedTheme } from "@/lib/utils/theme";
import { usePersistedEditable } from "@/lib/utils/lock";
import { usePersistedArrangeBaseline } from "@/lib/utils/arrangeBaseline";
import { usePersistedArrangeJustify } from "@/lib/utils/arrangeJustify";
import { arrangeLayout } from "@/lib/utils/arrange";
import { useToast } from "@/components/ui/Toaster";
import { usePersistence } from "@/lib/persistence/usePersistence";
import {
  WidgetPersistenceProvider,
  NoteCollapseOverrideProvider,
} from "@/lib/widgets/persistence";
import type { BoardState } from "@/lib/persistence/types";
const LG_COLS = 24; // v2 grid: 24 columns (finer placement/resize)

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
    restoreBoardLayout,
    addInstance,
    deleteInstance,
    moveInstanceToBoard,
    saveConfig,
    setShareTargetNote,
    collapseNote,
    flushNow,
    compactActive,
    addBoard,
    renameBoard,
    deleteBoard,
    setDefaultBoard,
    reorderBoards,
  } = persistence;

  // 편집/잠금 상태는 앱을 다시 시작해도 유지(localStorage). 기본=편집 가능.
  const [editable, setEditable] = usePersistedEditable();
  // 자동정렬 선택 옵션 — 기기별 localStorage(기본 OFF: 크기 변경 안 함).
  //  • justify  = 가로 채우기(폭을 maxW까지 넓힘)
  //  • baseline = 행 높이 맞춤(행 높이 통일)
  const [arrangeJustify, setArrangeJustify] = usePersistedArrangeJustify();
  const [arrangeBaseline, setArrangeBaseline] = usePersistedArrangeBaseline();
  const { toast } = useToast();
  // Theme persists across reloads (localStorage). data-theme is also set pre-paint
  // by an inline script in app/layout.tsx so there is no flash on load.
  const [theme, setTheme] = usePersistedTheme();
  // Desktop palette collapsed flag — persisted in localStorage (SSR-safe hook).
  const [paletteCollapsed, setCollapsed] = usePaletteCollapsed();
  // 설정 다이얼로그(앱 표시·계정) + 팔레트에서 숨긴 위젯 타입(기기별 localStorage).
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const { hidden: hiddenWidgets } = useHiddenWidgets();
  // 팔레트에만 적용되는 필터 — 캔버스/포커스/편집은 전체 registry로 기존 인스턴스를 렌더.
  const paletteRegistry = React.useMemo<WidgetRegistry>(() => {
    if (hiddenWidgets.size === 0) return widgetRegistry;
    const out: WidgetRegistry = {};
    for (const [type, def] of Object.entries(widgetRegistry)) {
      if (!hiddenWidgets.has(type)) out[type] = def;
    }
    return out;
  }, [hiddenWidgets]);
  // 재정렬 신호: 모바일/태블릿에서 GridCanvas가 기기-로컬 배치를 비우고 재파생하도록.
  const [compactNonce, setCompactNonce] = React.useState(0);

  // Overlay ids edited/focused: track WHICH instance each overlay targets.
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [editId, setEditId] = React.useState<string | null>(null);

  // GridCanvas가 등록하는 브레이크포인트 인식 노트 접기 핸들러. FocusOverlay(그리드
  // 밖)의 '제목만 접기'도 이 경로를 타야 모바일 기기-로컬 레이아웃까지 갱신된다.
  // 등록 전(마운트 직전)엔 DB 경로(collapseNote)로 폴백.
  const gridCollapseRef = React.useRef<
    ((instanceId: string, level: "normal" | "more" | "title") => void) | null
  >(null);
  const registerGridCollapse = React.useCallback(
    (fn: (instanceId: string, level: "normal" | "more" | "title") => void) => {
      gridCollapseRef.current = fn;
    },
    [],
  );
  const collapseViaGrid = React.useCallback(
    (instanceId: string, level: "normal" | "more" | "title") => {
      (gridCollapseRef.current ?? collapseNote)(instanceId, level);
    },
    [collapseNote],
  );

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

  /* ----- 위젯을 다른 보드 탭으로 드래그-이동 ----- */
  const transferInstanceToBoard = React.useCallback(
    (instanceId: string, boardId: string) => {
      moveInstanceToBoard(instanceId, boardId);
      // 옮긴 보드를 곧바로 선택해 위젯이 도착한 곳이 보이도록(요구: 다른 탭이 선택되도록).
      setActiveId(boardId);
    },
    [moveInstanceToBoard, setActiveId],
  );

  const openEdit = React.useCallback(
    (instanceId: string) => {
      setEditId(instanceId);
      openOverlay(`edit:${instanceId}`);
    },
    [openOverlay],
  );

  // 위젯이 점유할 수 있는 최대 폭(registry maxSize.w, lg 열수로 클램프) 조회.
  const maxWOf = React.useCallback(
    (instanceId: string) => {
      const inst = active.instances.find((i) => i.instanceId === instanceId);
      const def = inst ? widgetRegistry[inst.type] : undefined;
      const m = def?.maxSize?.w ?? LG_COLS;
      return Math.min(m, LG_COLS);
    },
    [active.instances],
  );

  const compactActiveBoard = React.useCallback(() => {
    // 되돌리기용 스냅샷(현재 lg 레이아웃 깊은 복사) + 대상 보드 id.
    const boardId = activeId;
    const snapshot = active.layout.map((it) => ({ ...it }));

    // lg: 자동정렬(기본=크기 유지 공백 제거; 토글 시 가로 채우기·행 높이 맞춤)을 영속.
    // 동시에 nonce를 올려 모바일/태블릿(md/sm)에서는 기기-로컬 배치를 비우고 재파생.
    compactActive((layout) =>
      arrangeLayout(layout, {
        cols: LG_COLS,
        maxWOf,
        justify: arrangeJustify,
        equalizeHeights: arrangeBaseline,
      }),
    );
    setCompactNonce((n) => n + 1);

    // 적용된 옵션을 토스트 설명에 반영(기본은 크기 유지).
    const extras: string[] = [];
    if (arrangeJustify) extras.push("가로 채우기");
    if (arrangeBaseline) extras.push("행 높이 맞춤");
    const description =
      extras.length > 0
        ? `공백 제거 · ${extras.join(" · ")}`
        : "공백 제거 (위젯 크기 유지)";

    // 되돌리기 토스트 — 클릭 시 스냅샷으로 해당 보드 복원(탭을 바꿔도 정확한 보드).
    toast({
      title: "자동정렬 완료",
      description,
      durationMs: 7000,
      action: {
        label: "되돌리기",
        onClick: () => restoreBoardLayout(boardId, snapshot),
      },
    });
  }, [
    activeId,
    active.layout,
    compactActive,
    maxWOf,
    arrangeJustify,
    arrangeBaseline,
    toast,
    restoreBoardLayout,
  ]);

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
        onRename={() => requestRename(instance.instanceId)}
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
    <WidgetPersistenceProvider
      save={saveConfig}
      setShareTargetNote={setShareTargetNote}
      collapseNote={collapseNote}
    >
    <main className="min-h-dvh bg-background">
      {/* Sticky header: title + board tabs + toolbar.
          data-pb-sticky-header: 드래그 자동 스크롤이 상단 트리거 영역을 헤더
          바닥에 맞추기 위해 이 요소의 높이를 측정한다(useDragAutoScroll). */}
      <div
        data-pb-sticky-header
        className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur"
      >
        {/* Responsive header.
            • sm+ : 한 줄 — 제목 | 보드탭(가로 스크롤) | 툴바.
            • 좁은 모바일(< sm): 두 줄로 줄바꿈 — 1줄(제목 · 툴바), 2줄(보드탭 전체 폭
              가로 스크롤). 좁은 폭에서 제목·툴바가 가운데 탭 영역을 0으로 찌그러뜨려
              탭이 안 보이던 문제를 해결(탭이 자기 줄에서 전체 폭을 확보). */}
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-2 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-6 lg:px-8">
          {/* 왼쪽 상단 브랜드: tkLeen 마크 + 대시보드 제목 */}
          <div className="flex shrink-0 items-center gap-2">
            <BrandMark height={24} className="text-foreground" />
            <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              모두의 Dashboard
            </h1>
          </div>
          {/* 탭: 모바일에선 order로 둘째 줄 전체 폭(w-full), sm+에선 가운데 flex-1. */}
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
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
          {/* 툴바: 모바일에선 첫 줄 우측(ml-auto)으로 붙고, sm+에선 맨 끝 고정. */}
          <div className="ml-auto shrink-0 sm:ml-0">
            <Toolbar
              editable={editable}
              onToggleEditable={() => setEditable(!editable)}
              onCompact={compactActiveBoard}
              arrangeJustify={arrangeJustify}
              onToggleArrangeJustify={() => setArrangeJustify(!arrangeJustify)}
              arrangeBaseline={arrangeBaseline}
              onToggleArrangeBaseline={() => setArrangeBaseline(!arrangeBaseline)}
              paletteCollapsed={paletteCollapsed}
              onTogglePalette={() => setCollapsed(!paletteCollapsed)}
              theme={theme}
              onToggleTheme={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </div>

      {/*
        Body: full-width canvas. The palette is a FLOATING overlay (position:
        fixed) rendered OUTSIDE this flow, so toggling/moving it never changes the
        canvas's measured width — placed widgets stay put (issue ⑧/①).
      */}
      <WidgetPalette
        registry={paletteRegistry}
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
              onCollapseNote={collapseNote}
              onRegisterCollapse={registerGridCollapse}
              editable={editable}
              onDropWidget={addByDrop}
              renderActions={renderActions}
              onFocusInstance={openFocus}
              onTransferInstance={transferInstanceToBoard}
              storageKey={activeId}
              compactNonce={compactNonce}
            />
          )}
        </section>
      </div>

      {/* Account control — bottom-left avatar → email + 로그아웃.
          onBeforeSignOut: 세션 소멸 전에 대기 중 저장을 flush(유실 방지). */}
      <AccountMenu email={userEmail} onBeforeSignOut={flushNow} />

      {/* 설정 — 팔레트 앱 표시 토글 + 계정(비밀번호 변경) */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        email={userEmail}
      />

      {/* Overlays — share ONE back-stack LIFO with the mobile palette sheet.
          NoteCollapseOverrideProvider: 전체보기(ExpandedView)의 '제목만 접기'도
          GridCanvas의 브레이크포인트 인식 접기를 타게 한다(모바일 레이아웃 일관성). */}
      <NoteCollapseOverrideProvider collapseNote={collapseViaGrid}>
        <FocusOverlay
          registry={widgetRegistry}
          instance={focusInstance}
          open={focusOpen}
          onClose={closeTop}
        />
      </NoteCollapseOverrideProvider>
      <ConfigDialog
        registry={widgetRegistry}
        instance={editInstance}
        open={editOpen}
        onSave={saveConfig}
        onClose={closeTop}
      />
    </main>
    </WidgetPersistenceProvider>
  );
}

export default CanvasShell;
