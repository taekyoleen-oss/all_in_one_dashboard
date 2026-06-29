"use client";

/**
 * ============================================================================
 *  usePersistence — optimistic + debounced board/widget persistence (§5.4)
 * ============================================================================
 *
 *  Owns the canvas's board state and mirrors every mutation to Supabase through
 *  the browser client, RLS-gated to the signed-in user. The contract with the
 *  shell: call a mutation action → local state updates SYNCHRONOUSLY (optimistic)
 *  and the affected rows are marked dirty; a debounced flush batches the writes.
 *
 *  ── Persistence model (§5.4) ─────────────────────────────────────────────
 *   • Optimistic: UI never waits on the network — actions update React state now.
 *   • Debounced batch: dirty markers accumulate; after `DEBOUNCE_MS` of quiet we
 *     flush ONE batch (upsert dirty boards, upsert dirty widgets, delete removed
 *     rows). Coalescing reads the *latest* state, so 50 drag ticks → 1 write.
 *   • Desktop-only: only the lg layout is persisted (mobile is auto-derived). The
 *     UI layout is already the lg layout, so we just serialize x/y/w/h (+ derived
 *     min/max) into pb_widgets.layout.
 *   • Failure → toast + 다시 시도 retry; the dirty markers are KEPT (local draft),
 *     so the next successful flush (auto-retry or manual) ships the edit. We never
 *     discard the user's change on a transient write error.
 *   • Default-board invariant: switching the default updates the old + new board
 *     atomically-enough (old cleared first, then new set) so the partial unique
 *     index (one is_default per user) is never violated mid-flush.
 *
 *  React 19: actions are stable useCallback closures over a `stateRef` (latest
 *  state) — no setState-in-effect; the flush timer is the only effect-ish piece
 *  and it is driven by an explicit `scheduleFlush()` call from each action.
 * ============================================================================
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { widgetRegistry } from "@/components/widgets/registry";
import {
  computeNoteCollapse,
  type NoteCollapseConfig,
} from "@/components/widgets/note/collapseLayout";
import { createInstance } from "@/lib/utils/grid";
import { useToast } from "@/components/ui/Toaster";
import {
  layoutToJson,
  type BoardState,
  type BoardMeta,
} from "@/lib/persistence/types";
import type {
  CanvasLayoutItem,
  WidgetInstance,
} from "@/components/canvas/GridCanvas";
import type { Json, TablesInsert } from "@/types/database";

const DEBOUNCE_MS = 600; // §5.4 batched save window (400–800ms band)
const MAX_AUTO_RETRIES = 3; // automatic retries before falling back to manual toast
const RETRY_BACKOFF_MS = 1500;

/** Pending write intent accumulated between flushes. */
interface DirtyQueue {
  boards: Set<string>; // board ids to upsert (meta)
  widgets: Set<string>; // widget ids to upsert (config + layout)
  deletedBoards: Set<string>;
  deletedWidgets: Set<string>;
}

function emptyQueue(): DirtyQueue {
  return {
    boards: new Set(),
    widgets: new Set(),
    deletedBoards: new Set(),
    deletedWidgets: new Set(),
  };
}

export interface UsePersistenceResult {
  boards: BoardState[];
  activeId: string;
  active: BoardState;
  setActiveId: (id: string) => void;

  /** Replace the active board via an updater (move/resize/add/delete/config). */
  updateActiveLayout: (next: CanvasLayoutItem[]) => void;
  addInstance: (instance: WidgetInstance, layoutItem: CanvasLayoutItem) => void;
  deleteInstance: (instanceId: string) => void;
  /** Move an instance to another board (drag onto a tab). No-op if same board. */
  moveInstanceToBoard: (instanceId: string, targetBoardId: string) => void;
  saveConfig: (instanceId: string, nextConfig: unknown) => void;
  /**
   * Designate the single "공유 받기" note across ALL boards. on=true sets the
   * flag on `instanceId` and clears it on every other note; on=false just clears
   * `instanceId`. Marks each changed note dirty (debounced flush persists).
   */
  setShareTargetNote: (instanceId: string, on: boolean) => void;
  /**
   * 노트 타일 접기(본문 상단 토글). level 'more' = 현재 그리드 h를 normalHeight로
   * 기억하고 h를 절반(round, note minSize.h 이상)으로 줄임. level 'normal' = 기억해
   * 둔 normalHeight로 h 복원. 그리드가 자유 배치(컴팩션 없음)라 높이 변화량(delta)만큼
   * "노트 아래에 있고 노트 열과 가로로 겹치는" 위젯들을 함께 이동시켜, 더접기 시 그만큼
   * 올라오고 접기 시 정확히 그만큼 내려가게 한다. layout과 config(collapse/normalHeight)를
   * 한 번에 갱신하고 옮겨진 위젯까지 dirty 마킹(디바운스 flush로 영속).
   */
  collapseNote: (instanceId: string, level: "normal" | "more") => void;
  compactActive: (compactor: (l: CanvasLayoutItem[]) => CanvasLayoutItem[]) => void;
  /**
   * Restore a SPECIFIC board's layout to an exact snapshot (자동정렬 되돌리기). Unlike
   * updateActiveLayout it targets `boardId` explicitly, so undo restores the right
   * board even if the user has since switched tabs. No-op if the board is gone.
   */
  restoreBoardLayout: (boardId: string, layout: CanvasLayoutItem[]) => void;

  /** Board ops. */
  addBoard: () => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;
  setDefaultBoard: (boardId: string) => void;
  /** Reorder boards to match `orderedIds` (recomputes + persists sort_order). */
  reorderBoards: (orderedIds: string[]) => void;

  /** True while a flush is in flight (for optional UI). */
  saving: boolean;
}

/** Build the layout jsonb for an instance, attaching registry-derived min/max. */
function layoutJsonFor(
  item: CanvasLayoutItem,
  type: string,
): Json {
  const def = widgetRegistry[type];
  const bounds = def
    ? {
        minW: def.minSize.w,
        minH: def.minSize.h,
        maxW: Number.isFinite(def.maxSize.w) ? def.maxSize.w : undefined,
        maxH: Number.isFinite(def.maxSize.h) ? def.maxSize.h : undefined,
      }
    : undefined;
  return layoutToJson(item, bounds) as unknown as Json;
}

export function usePersistence(
  initialBoards: BoardState[],
  userId: string,
): UsePersistenceResult {
  const { toast } = useToast();

  // Guarantee at least one board to render against (defensive — server bootstraps).
  const seed = initialBoards.length > 0 ? initialBoards : [emptyBoard()];

  const [boards, setBoards] = React.useState<BoardState[]>(seed);
  const [activeId, setActiveId] = React.useState<string>(seed[0].meta.id);
  const [saving, setSaving] = React.useState(false);

  // 마지막으로 열었던 탭(보드)을 기기별로 기억해 앱 재시작 시 복원한다. userId로 키를
  // 분리(같은 기기 다른 계정 충돌 방지). 보안/민감정보 아님 → DB 아닌 localStorage.
  const lastBoardKey = `pb:last-board:${userId}`;
  const persistActiveId = React.useCallback(
    (id: string) => {
      try {
        window.localStorage.setItem(lastBoardKey, id);
      } catch {
        /* private 모드/용량 초과 등은 조용히 무시 — 탭 복원은 부가 기능 */
      }
    },
    [lastBoardKey],
  );
  // 탭 선택(클릭·추가·삭제)의 단일 경로: 상태 갱신 + 마지막 탭 기억.
  const selectActiveId = React.useCallback(
    (id: string) => {
      setActiveId(id);
      persistActiveId(id);
    },
    [persistActiveId],
  );

  // Latest state, readable inside the debounced flush without re-creating
  // callbacks. Synced in an effect (post-commit) — never written during render.
  // The flush is debounced (≥600ms), so it always runs after this effect.
  const stateRef = React.useRef(boards);
  React.useEffect(() => {
    stateRef.current = boards;
  }, [boards]);

  // 앱 재시작 시 마지막 탭 복원. SSR/hydration 안전을 위해 초기 activeId는 서버와 동일한
  // seed[0]로 두고, 마운트 후 한 번만 저장된 보드로 전환한다(저장값이 현재 보드 목록에
  // 있을 때만; 삭제된 보드면 기본 보드 유지). 복원 자체는 이미 저장된 값이라 재저장 불필요.
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(lastBoardKey);
    } catch {
      stored = null;
    }
    if (
      stored &&
      stored !== activeId &&
      stateRef.current.some((b) => b.meta.id === stored)
    ) {
      setActiveId(stored);
    }
    // 마운트 1회만 실행(restoredRef 가드). activeId는 초기값 비교용으로만 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBoardKey]);

  const queueRef = React.useRef<DirtyQueue>(emptyQueue());
  const timerRef = React.useRef<number | null>(null);
  const flushingRef = React.useRef(false);
  const retryRef = React.useRef(0);

  const supabaseRef = React.useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = React.useCallback(() => {
    supabaseRef.current ??= createClient();
    return supabaseRef.current;
  }, []);

  // `flush` and `scheduleFlush` are mutually recursive (flush → retry →
  // scheduleFlush → flush). We break the cycle with a ref: scheduleFlush (defined
  // first) calls the LATEST flush via `flushRef`, and flush calls scheduleFlush
  // directly. `flushRef` is assigned right after `flush` is created.
  const flushRef = React.useRef<() => Promise<void>>(async () => {});

  const scheduleFlush = React.useCallback((delay = DEBOUNCE_MS) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, delay);
  }, []);

  /* --------------------------- the flush engine --------------------------- */

  const flush = React.useCallback(async () => {
    if (flushingRef.current) return; // a flush is already running
    const q = queueRef.current;
    const hasWork =
      q.boards.size ||
      q.widgets.size ||
      q.deletedBoards.size ||
      q.deletedWidgets.size;
    if (!hasWork) return;

    // Snapshot + reset the queue so edits made DURING the flush re-arm a new one.
    queueRef.current = emptyQueue();
    flushingRef.current = true;
    setSaving(true);

    const supabase = getSupabase();
    const state = stateRef.current;
    const boardById = new Map(state.map((b) => [b.meta.id, b]));

    try {
      // 1) Deletes first (widgets, then boards) — frees the partial-default index
      //    and avoids upserting rows we are about to remove.
      if (q.deletedWidgets.size > 0) {
        const { error } = await supabase
          .from("pb_widgets")
          .delete()
          .in("id", [...q.deletedWidgets]);
        if (error) throw error;
      }
      if (q.deletedBoards.size > 0) {
        const { error } = await supabase
          .from("pb_dashboards")
          .delete()
          .in("id", [...q.deletedBoards]);
        if (error) throw error;
      }

      // 2) Board upserts. To respect the single-default unique index, clear the
      //    default flag on any board that should NOT be default before setting it
      //    on the one that should — done as part of the same payload by writing
      //    the authoritative is_default for every dirty board.
      const boardRows: TablesInsert<"pb_dashboards">[] = [];
      for (const id of q.boards) {
        const b = boardById.get(id);
        if (!b) continue; // deleted after being marked — skip
        boardRows.push({
          id: b.meta.id,
          user_id: userId,
          name: b.meta.name,
          is_default: b.meta.isDefault,
          sort_order: b.meta.sortOrder,
        });
      }
      // When a default change is in the batch, ensure non-default boards are
      // written first so the index never sees two defaults transiently.
      boardRows.sort((a, b) => Number(a.is_default) - Number(b.is_default));
      if (boardRows.length > 0) {
        // Upsert one-by-one in default-last order to dodge the partial unique
        // index firing on a multi-row upsert that momentarily holds 2 defaults.
        for (const row of boardRows) {
          const { error } = await supabase
            .from("pb_dashboards")
            .upsert(row, { onConflict: "id" });
          if (error) throw error;
        }
      }

      // 3) Widget upserts (config + layout). Resolve each id to its current
      //    instance + layout from the latest state.
      const widgetRows: TablesInsert<"pb_widgets">[] = [];
      for (const wid of q.widgets) {
        // Find which board holds this widget + its current layout.
        let found:
          | { instance: WidgetInstance; layout: CanvasLayoutItem; boardId: string }
          | null = null;
        for (const b of state) {
          const inst = b.instances.find((i) => i.instanceId === wid);
          if (!inst) continue;
          const lay =
            b.layout.find((l) => l.instanceId === wid) ??
            ({ instanceId: wid, x: 0, y: 0, w: 3, h: 2 } as CanvasLayoutItem);
          found = { instance: inst, layout: lay, boardId: b.meta.id };
          break;
        }
        if (!found) continue; // deleted after marking — skip
        widgetRows.push({
          id: found.instance.instanceId,
          dashboard_id: found.boardId,
          user_id: userId,
          type: found.instance.type,
          config: (found.instance.config ?? {}) as Json,
          layout: layoutJsonFor(found.layout, found.instance.type),
        });
      }
      if (widgetRows.length > 0) {
        const { error } = await supabase
          .from("pb_widgets")
          .upsert(widgetRows, { onConflict: "id" });
        if (error) throw error;
      }

      // Success — clear retry counter.
      retryRef.current = 0;
    } catch (err) {
      // Re-merge this batch's intents back into the (possibly newly-populated)
      // queue so nothing is lost — the local state is the source of truth and the
      // next flush re-derives payloads from it (local draft preserved, §5.4).
      const q2 = queueRef.current;
      q.boards.forEach((id) => q2.boards.add(id));
      q.widgets.forEach((id) => q2.widgets.add(id));
      q.deletedBoards.forEach((id) => q2.deletedBoards.add(id));
      q.deletedWidgets.forEach((id) => q2.deletedWidgets.add(id));

      flushingRef.current = false;
      setSaving(false);

      if (retryRef.current < MAX_AUTO_RETRIES) {
        retryRef.current += 1;
        // Auto-retry with backoff.
        scheduleFlush(RETRY_BACKOFF_MS * retryRef.current);
        return;
      }

      // Out of auto-retries — surface a toast with a manual retry.
      retryRef.current = 0;
      console.error("[paneboard] persistence flush failed", err);
      toast({
        variant: "error",
        title: "변경 사항 저장 실패",
        description:
          "네트워크 또는 서버 오류로 저장하지 못했습니다. 변경은 로컬에 보존됩니다.",
        action: {
          label: "다시 시도",
          onClick: () => scheduleFlush(0),
        },
        durationMs: 0,
      });
      return;
    }

    flushingRef.current = false;
    setSaving(false);

    // If edits arrived during the flush, schedule the next batch.
    const q3 = queueRef.current;
    if (
      q3.boards.size ||
      q3.widgets.size ||
      q3.deletedBoards.size ||
      q3.deletedWidgets.size
    ) {
      scheduleFlush(DEBOUNCE_MS);
    }
  }, [getSupabase, toast, userId, scheduleFlush]);

  // Keep the ref pointed at the latest flush closure (so scheduleFlush's timer
  // calls the current state/userId capture). Synced post-commit, not in render.
  React.useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Flush any pending work on unmount (best-effort — fire and forget).
  React.useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      void flushRef.current();
    };
  }, []);

  /* ---------------------------- dirty markers ----------------------------- */

  const markBoard = React.useCallback(
    (id: string) => {
      queueRef.current.boards.add(id);
      queueRef.current.deletedBoards.delete(id);
      scheduleFlush();
    },
    [scheduleFlush],
  );
  const markWidget = React.useCallback(
    (id: string) => {
      queueRef.current.widgets.add(id);
      queueRef.current.deletedWidgets.delete(id);
      scheduleFlush();
    },
    [scheduleFlush],
  );
  const markWidgetDeleted = React.useCallback(
    (id: string) => {
      queueRef.current.deletedWidgets.add(id);
      queueRef.current.widgets.delete(id); // no point upserting a row we delete
      scheduleFlush();
    },
    [scheduleFlush],
  );
  const markBoardDeleted = React.useCallback(
    (id: string) => {
      queueRef.current.deletedBoards.add(id);
      queueRef.current.boards.delete(id);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  /* ------------------------------- selectors ------------------------------ */

  const active =
    boards.find((b) => b.meta.id === activeId) ?? boards[0] ?? emptyBoard();

  /* ----------------------------- widget actions --------------------------- */

  /** Replace the active board's layout (move/resize). Marks moved widgets dirty. */
  const updateActiveLayout = React.useCallback(
    (next: CanvasLayoutItem[]) => {
      const a = stateRef.current.find((b) => b.meta.id === activeId);
      if (!a) return;
      // Only mark widgets whose placement actually changed.
      const prevById = new Map(a.layout.map((l) => [l.instanceId, l]));
      for (const it of next) {
        const p = prevById.get(it.instanceId);
        if (!p || p.x !== it.x || p.y !== it.y || p.w !== it.w || p.h !== it.h) {
          queueRef.current.widgets.add(it.instanceId);
        }
      }
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId ? { ...b, layout: next } : b,
        ),
      );
      scheduleFlush();
    },
    [activeId, scheduleFlush],
  );

  const restoreBoardLayout = React.useCallback(
    (boardId: string, layout: CanvasLayoutItem[]) => {
      const a = stateRef.current.find((b) => b.meta.id === boardId);
      if (!a) return;
      // Mark every widget whose placement differs from the snapshot dirty so the
      // restore persists (auto-arrange already moved them server-side too).
      const prevById = new Map(a.layout.map((l) => [l.instanceId, l]));
      for (const it of layout) {
        const p = prevById.get(it.instanceId);
        if (!p || p.x !== it.x || p.y !== it.y || p.w !== it.w || p.h !== it.h) {
          queueRef.current.widgets.add(it.instanceId);
        }
      }
      setBoards((prev) =>
        prev.map((b) => (b.meta.id === boardId ? { ...b, layout } : b)),
      );
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const addInstance = React.useCallback(
    (instance: WidgetInstance, layoutItem: CanvasLayoutItem) => {
      // 첫 노트는 기본값으로 "공유 받기" ON: 아직 어떤 노트도 공유 대상이 아니면
      // 새로 추가되는 노트를 모바일 공유 저장 대상으로 지정한다(단일 불변식 유지 —
      // 이미 대상이 있으면 새 노트는 false). 노트가 아니면 그대로.
      let toAdd = instance;
      if (instance.type === "note") {
        const anyTarget = stateRef.current.some((b) =>
          b.instances.some(
            (i) =>
              i.type === "note" &&
              Boolean((i.config as { shareTarget?: boolean } | null)?.shareTarget),
          ),
        );
        // No target yet → this note becomes it. A target already exists → make sure
        // the new note is NOT a target (a duplicated/pasted note may carry a copied
        // shareTarget flag — strip it to keep exactly one).
        toAdd = {
          ...instance,
          config: { ...(instance.config as object), shareTarget: !anyTarget },
        };
      }
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId
            ? {
                ...b,
                instances: [...b.instances, toAdd],
                layout: [...b.layout, layoutItem],
              }
            : b,
        ),
      );
      markWidget(toAdd.instanceId);
    },
    [activeId, markWidget],
  );

  const deleteInstance = React.useCallback(
    (instanceId: string) => {
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId
            ? {
                ...b,
                instances: b.instances.filter(
                  (i) => i.instanceId !== instanceId,
                ),
                layout: b.layout.filter((l) => l.instanceId !== instanceId),
              }
            : b,
        ),
      );
      markWidgetDeleted(instanceId);
    },
    [activeId, markWidgetDeleted],
  );

  const moveInstanceToBoard = React.useCallback(
    (instanceId: string, targetBoardId: string) => {
      setBoards((prev) => {
        const src = prev.find((b) =>
          b.instances.some((i) => i.instanceId === instanceId),
        );
        if (!src || src.meta.id === targetBoardId) return prev;
        if (!prev.some((b) => b.meta.id === targetBoardId)) return prev;
        const inst = src.instances.find((i) => i.instanceId === instanceId)!;
        const lay =
          src.layout.find((l) => l.instanceId === instanceId) ??
          ({ instanceId, x: 0, y: 0, w: 6, h: 4 } as CanvasLayoutItem);
        return prev.map((b) => {
          if (b.meta.id === src.meta.id) {
            // Remove from the source board.
            return {
              ...b,
              instances: b.instances.filter(
                (i) => i.instanceId !== instanceId,
              ),
              layout: b.layout.filter((l) => l.instanceId !== instanceId),
            };
          }
          if (b.meta.id === targetBoardId) {
            // Append below everything in the target board (x preserved, no overlap).
            const maxY = b.layout.reduce(
              (m, l) => Math.max(m, l.y + l.h),
              0,
            );
            const placed: CanvasLayoutItem = {
              instanceId,
              x: Math.min(lay.x, Math.max(0, 24 - lay.w)),
              y: maxY,
              w: lay.w,
              h: lay.h,
            };
            return {
              ...b,
              instances: [...b.instances, inst],
              layout: [...b.layout, placed],
            };
          }
          return b;
        });
      });
      // Re-upsert the widget row: the flush re-derives its dashboard_id from the
      // board that now holds it, so this single mark re-homes it (no delete needed).
      markWidget(instanceId);
    },
    [markWidget],
  );

  const saveConfig = React.useCallback(
    (instanceId: string, nextConfig: unknown) => {
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId
            ? {
                ...b,
                instances: b.instances.map((i) =>
                  i.instanceId === instanceId
                    ? { ...i, config: nextConfig }
                    : i,
                ),
              }
            : b,
        ),
      );
      markWidget(instanceId);
    },
    [activeId, markWidget],
  );

  const setShareTargetNote = React.useCallback(
    (instanceId: string, on: boolean) => {
      const changed: string[] = [];
      setBoards((prev) =>
        prev.map((b) => ({
          ...b,
          instances: b.instances.map((i) => {
            if (i.type !== "note") return i;
            const cfg = (i.config ?? {}) as { shareTarget?: boolean };
            const cur = Boolean(cfg.shareTarget);
            // on=true → exactly this note true, every other note false.
            // on=false → only this note false; others untouched.
            const next = on ? i.instanceId === instanceId : cur && i.instanceId !== instanceId;
            if (cur === next) return i;
            changed.push(i.instanceId);
            return { ...i, config: { ...cfg, shareTarget: next } };
          }),
        })),
      );
      changed.forEach(markWidget);
    },
    [markWidget],
  );

  const collapseNote = React.useCallback(
    (instanceId: string, level: "normal" | "more") => {
      const minH = widgetRegistry["note"]?.minSize.h ?? 3;
      // 노트 외에 위치가 바뀐(아래로/위로 따라 이동한) 위젯 id를 모아 dirty 마킹한다.
      const moved: string[] = [];
      setBoards((prev) =>
        prev.map((b) => {
          if (b.meta.id !== activeId) return b;
          const inst = b.instances.find((i) => i.instanceId === instanceId);
          if (!inst) return b;
          const cfg = (inst.config ?? {}) as NoteCollapseConfig;
          // 순수 함수가 노트 h 변경 + 아래 위젯 이동을 모두 계산(collapseLayout.ts).
          const res = computeNoteCollapse(
            b.layout,
            instanceId,
            cfg,
            level,
            minH,
          );
          if (!res.changed) return b;
          res.movedIds.forEach((id) => moved.push(id));
          return {
            ...b,
            instances: b.instances.map((i) =>
              i.instanceId === instanceId
                ? { ...i, config: { ...cfg, ...res.config } }
                : i,
            ),
            layout: res.layout,
          };
        }),
      );
      markWidget(instanceId);
      moved.forEach(markWidget);
    },
    [activeId, markWidget],
  );

  const compactActive = React.useCallback(
    (compactor: (l: CanvasLayoutItem[]) => CanvasLayoutItem[]) => {
      const a = stateRef.current.find((b) => b.meta.id === activeId);
      if (!a) return;
      const next = compactor(a.layout);
      // Mark every widget whose placement changed.
      const prevById = new Map(a.layout.map((l) => [l.instanceId, l]));
      for (const it of next) {
        const p = prevById.get(it.instanceId);
        if (!p || p.x !== it.x || p.y !== it.y || p.w !== it.w || p.h !== it.h) {
          queueRef.current.widgets.add(it.instanceId);
        }
      }
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId ? { ...b, layout: next } : b,
        ),
      );
      scheduleFlush();
    },
    [activeId, scheduleFlush],
  );

  /* ------------------------------ board actions --------------------------- */

  const addBoard = React.useCallback(() => {
    const id = crypto.randomUUID();
    const maxSort = stateRef.current.reduce(
      (m, b) => Math.max(m, b.meta.sortOrder),
      -1,
    );
    const meta: BoardMeta = {
      id,
      name: `보드 ${stateRef.current.length + 1}`,
      isDefault: false,
      sortOrder: maxSort + 1,
    };
    setBoards((prev) => [...prev, { meta, instances: [], layout: [] }]);
    selectActiveId(id);
    markBoard(id);
  }, [markBoard, selectActiveId]);

  const renameBoard = React.useCallback(
    (boardId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === boardId
            ? { ...b, meta: { ...b.meta, name: trimmed } }
            : b,
        ),
      );
      markBoard(boardId);
    },
    [markBoard],
  );

  const deleteBoard = React.useCallback(
    (boardId: string) => {
      const cur = stateRef.current;
      if (cur.length <= 1) return; // never delete the last board
      const target = cur.find((b) => b.meta.id === boardId);
      if (!target) return;

      const remaining = cur.filter((b) => b.meta.id !== boardId);
      // If we deleted the default board, promote the first remaining board.
      let promotedId: string | null = null;
      const next = remaining.map((b, idx) => {
        if (target.meta.isDefault && idx === 0 && !b.meta.isDefault) {
          promotedId = b.meta.id;
          return { ...b, meta: { ...b.meta, isDefault: true } };
        }
        return b;
      });

      setBoards(next);
      if (activeId === boardId) selectActiveId(next[0].meta.id);

      // Widgets cascade-delete in the DB (FK on delete cascade); we only need to
      // delete the board row and clear any pending widget writes for it.
      for (const inst of target.instances) {
        queueRef.current.widgets.delete(inst.instanceId);
        queueRef.current.deletedWidgets.delete(inst.instanceId);
      }
      markBoardDeleted(boardId);
      if (promotedId) markBoard(promotedId);
    },
    [activeId, markBoard, markBoardDeleted, selectActiveId],
  );

  const setDefaultBoard = React.useCallback(
    (boardId: string) => {
      const cur = stateRef.current;
      const target = cur.find((b) => b.meta.id === boardId);
      if (!target || target.meta.isDefault) return;
      const changed: string[] = [];
      setBoards((prev) =>
        prev.map((b) => {
          if (b.meta.id === boardId && !b.meta.isDefault) {
            changed.push(b.meta.id);
            return { ...b, meta: { ...b.meta, isDefault: true } };
          }
          if (b.meta.id !== boardId && b.meta.isDefault) {
            changed.push(b.meta.id);
            return { ...b, meta: { ...b.meta, isDefault: false } };
          }
          return b;
        }),
      );
      changed.forEach(markBoard);
    },
    [markBoard],
  );

  const reorderBoards = React.useCallback(
    (orderedIds: string[]) => {
      const cur = stateRef.current;
      const byId = new Map(cur.map((b) => [b.meta.id, b]));

      // Build the new visual order from `orderedIds`, keeping it total + stable:
      // honor every id we recognize (in the requested order), then append any
      // board the caller omitted (defensive — never drop a board on a partial list).
      const seen = new Set<string>();
      const ordered: BoardState[] = [];
      for (const id of orderedIds) {
        const b = byId.get(id);
        if (b && !seen.has(id)) {
          ordered.push(b);
          seen.add(id);
        }
      }
      for (const b of cur) {
        if (!seen.has(b.meta.id)) ordered.push(b);
      }

      // Reassign sort_order by index; mark only the boards whose value changed so
      // the debounced flush upserts pb_dashboards.sort_order for exactly those.
      // is_default is left untouched (reorder never changes the default board).
      const changed: string[] = [];
      const next = ordered.map((b, idx) => {
        if (b.meta.sortOrder === idx) return b;
        changed.push(b.meta.id);
        return { ...b, meta: { ...b.meta, sortOrder: idx } };
      });

      if (changed.length === 0) return; // order unchanged — no write
      setBoards(next); // active selection survives: activeId is untouched
      changed.forEach(markBoard);
    },
    [markBoard],
  );

  return {
    boards,
    activeId,
    active,
    // 외부(탭 클릭)도 selectActiveId로 — 전환 시 마지막 탭을 기기에 기억한다.
    setActiveId: selectActiveId,
    updateActiveLayout,
    restoreBoardLayout,
    addInstance,
    deleteInstance,
    moveInstanceToBoard,
    saveConfig,
    setShareTargetNote,
    collapseNote,
    compactActive,
    addBoard,
    renameBoard,
    deleteBoard,
    setDefaultBoard,
    reorderBoards,
    saving,
  };
}

/** A throwaway empty board (only used if the server passed zero boards). */
function emptyBoard(): BoardState {
  return {
    meta: {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : "local-board",
      name: "내 보드",
      isDefault: true,
      sortOrder: 0,
    },
    instances: [],
    layout: [],
  };
}

/* Re-export the instance factory binding so the shell can mint instances against
   the same registry the hook persists (keeps the contract in one import site). */
export { createInstance, widgetRegistry };
