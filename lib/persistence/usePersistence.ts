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
  saveConfig: (instanceId: string, nextConfig: unknown) => void;
  compactActive: (compactor: (l: CanvasLayoutItem[]) => CanvasLayoutItem[]) => void;

  /** Board ops. */
  addBoard: () => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;
  setDefaultBoard: (boardId: string) => void;

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

  // Latest state, readable inside the debounced flush without re-creating
  // callbacks. Synced in an effect (post-commit) — never written during render.
  // The flush is debounced (≥600ms), so it always runs after this effect.
  const stateRef = React.useRef(boards);
  React.useEffect(() => {
    stateRef.current = boards;
  }, [boards]);

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

  const addInstance = React.useCallback(
    (instance: WidgetInstance, layoutItem: CanvasLayoutItem) => {
      setBoards((prev) =>
        prev.map((b) =>
          b.meta.id === activeId
            ? {
                ...b,
                instances: [...b.instances, instance],
                layout: [...b.layout, layoutItem],
              }
            : b,
        ),
      );
      markWidget(instance.instanceId);
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
    setActiveId(id);
    markBoard(id);
  }, [markBoard]);

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
      if (activeId === boardId) setActiveId(next[0].meta.id);

      // Widgets cascade-delete in the DB (FK on delete cascade); we only need to
      // delete the board row and clear any pending widget writes for it.
      for (const inst of target.instances) {
        queueRef.current.widgets.delete(inst.instanceId);
        queueRef.current.deletedWidgets.delete(inst.instanceId);
      }
      markBoardDeleted(boardId);
      if (promotedId) markBoard(promotedId);
    },
    [activeId, markBoard, markBoardDeleted],
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

  return {
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
