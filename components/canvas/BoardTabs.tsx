"use client";

/**
 * ============================================================================
 *  BoardTabs — multi-board switcher (설계서 §3 보드 탭, §7 멀티 보드)
 * ============================================================================
 *
 *  Tabs for each board (업무 / 투자 / 개인 …) plus a `+` to add one. Switching a
 *  tab swaps the active board's instances + layout. Each board is backed by a
 *  `pb_dashboards` row; the active board's id/name/is_default/sort_order are
 *  persisted via the usePersistence hook in CanvasShell.
 *
 *  Per-tab affordances:
 *    • ✕ delete button — on EVERY tab (visible on hover/focus; always shown on the
 *      active tab). Asks a lightweight confirm, then onDeleteBoard(id). Disabled
 *      with a tooltip when only ONE board remains. Works for ANY board, not just
 *      the active one.
 *    • ⋮ actions menu (active tab) — 이름 변경 / 기본 보드로 설정 / 삭제.
 *
 *  Reorder (⑬): tabs are draggable left/right with a drop-indicator insertion
 *  line; the new visual order recomputes each board's sort_order via onReorder.
 *  Keyboard a11y fallback: Alt+←/→ moves the focused tab one slot.
 *
 *  Accessibility: a proper `role="tablist"` with arrow-key roving focus and
 *  aria-selected; the active tab is distinguished by underline + weight + a
 *  small ★ on the default board. Reorder honors prefers-reduced-motion (the
 *  drop indicator's transitions are governed by the global reduced-motion block).
 * ============================================================================
 */

import * as React from "react";
import {
  Plus,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/primitives";

export interface BoardMeta {
  id: string;
  name: string;
  /** True for the user's default board (★). Optional for backward-compat. */
  isDefault?: boolean;
}

export interface BoardTabsProps {
  boards: BoardMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddBoard: () => void;
  /** Rename a board (persisted). */
  onRenameBoard?: (id: string, name: string) => void;
  /** Delete a board (persisted; disabled when only one board remains). */
  onDeleteBoard?: (id: string) => void;
  /** Mark a board as the default (single-default invariant). */
  onSetDefaultBoard?: (id: string) => void;
  /** Reorder boards to this exact left→right id order (recomputes sort_order). */
  onReorder?: (orderedIds: string[]) => void;
}

const LAST_BOARD_HINT = "마지막 보드는 삭제할 수 없습니다";

export function BoardTabs({
  boards,
  activeId,
  onSelect,
  onAddBoard,
  onRenameBoard,
  onDeleteBoard,
  onSetDefaultBoard,
  onReorder,
}: BoardTabsProps) {
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  // Inline-rename state: which board id is being renamed (null = none).
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // ── Drag-reorder bookkeeping ──────────────────────────────────────────────
  // `dragId` = the board currently being dragged (null = not dragging).
  // `dropIndex` = insertion slot in the CURRENT list (0..boards.length); the
  // indicator line renders before the tab at that index (or after the last).
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);

  const canReorder = !!onReorder && boards.length > 1;

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (renamingId) return;

    // Alt+←/→ → MOVE the focused tab one slot (keyboard reorder fallback).
    if (
      canReorder &&
      e.altKey &&
      (e.key === "ArrowRight" || e.key === "ArrowLeft")
    ) {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const target = idx + dir;
      if (target < 0 || target >= boards.length) return;
      const ids = boards.map((b) => b.id);
      const [moved] = ids.splice(idx, 1);
      ids.splice(target, 0, moved);
      onReorder?.(ids);
      // Keep focus on the moved tab after it re-renders in its new position.
      requestAnimationFrame(() => tabRefs.current[moved]?.focus());
      return;
    }

    // Plain ←/→ → roving focus + select (unchanged).
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = boards[(idx + dir + boards.length) % boards.length];
    if (next) {
      onSelect(next.id);
      tabRefs.current[next.id]?.focus();
    }
  };

  const startRename = React.useCallback((board: BoardMeta) => {
    setRenamingId(board.id);
    setDraftName(board.name);
    // Focus + select after the input mounts.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const commitRename = React.useCallback(() => {
    if (renamingId && draftName.trim()) {
      onRenameBoard?.(renamingId, draftName);
    }
    setRenamingId(null);
  }, [renamingId, draftName, onRenameBoard]);

  const cancelRename = React.useCallback(() => setRenamingId(null), []);

  const canDelete = boards.length > 1;

  const requestDelete = React.useCallback(
    (board: BoardMeta) => {
      if (!onDeleteBoard || !canDelete) return;
      // Lightweight confirm — the board may hold widgets.
      const ok = window.confirm(
        `'${board.name}' 보드를 삭제할까요? 이 보드의 위젯도 함께 삭제됩니다.`,
      );
      if (ok) onDeleteBoard(board.id);
    },
    [onDeleteBoard, canDelete],
  );

  /* ----------------------------- drag handlers ---------------------------- */

  const handleDragStart = React.useCallback(
    (e: React.DragEvent, board: BoardMeta) => {
      if (!canReorder) return;
      setDragId(board.id);
      e.dataTransfer.effectAllowed = "move";
      // Some browsers need data set for a drag to initiate.
      try {
        e.dataTransfer.setData("text/plain", board.id);
      } catch {
        /* setData can throw in rare environments — drag still works via state */
      }
    },
    [canReorder],
  );

  const handleDragOverTab = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>, idx: number) => {
      if (!dragId) return;
      e.preventDefault(); // allow drop
      e.dataTransfer.dropEffect = "move";
      // Insert before this tab if the pointer is on its left half, else after.
      const rect = e.currentTarget.getBoundingClientRect();
      const after = e.clientX - rect.left > rect.width / 2;
      const target = after ? idx + 1 : idx;
      setDropIndex((prev) => (prev === target ? prev : target));
    },
    [dragId],
  );

  const applyReorder = React.useCallback(
    (insertAt: number) => {
      if (!dragId || !onReorder) return;
      const from = boards.findIndex((b) => b.id === dragId);
      if (from < 0) return;
      const ids = boards.map((b) => b.id);
      const [moved] = ids.splice(from, 1);
      // `insertAt` indexes the ORIGINAL list; removing `moved` shifts everything
      // after `from` left by one, so decrement the target when inserting past it.
      const dest = insertAt > from ? insertAt - 1 : insertAt;
      ids.splice(dest, 0, moved);
      onReorder(ids);
    },
    [dragId, onReorder, boards],
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dropIndex != null) applyReorder(dropIndex);
      setDragId(null);
      setDropIndex(null);
    },
    [dropIndex, applyReorder],
  );

  const handleDragEnd = React.useCallback(() => {
    setDragId(null);
    setDropIndex(null);
  }, []);

  /** A thin vertical insertion line; shown at `slot` while dragging over it. */
  const Indicator = ({ slot }: { slot: number }) =>
    dragId != null && dropIndex === slot ? (
      <span
        aria-hidden
        className="mx-0.5 h-6 w-0.5 shrink-0 self-center rounded-full bg-primary"
      />
    ) : null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <div
        role="tablist"
        aria-label="보드"
        className="flex items-center gap-1"
        // Dropping in the tablist gutter (not on a tab) still commits the last
        // computed insertion slot.
        onDrop={handleDrop}
        onDragOver={(e) => {
          if (dragId) e.preventDefault();
        }}
      >
        {boards.map((board, idx) => {
          const active = board.id === activeId;
          const renaming = renamingId === board.id;
          const dragging = dragId === board.id;

          if (renaming) {
            return (
              <form
                key={board.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRename();
                }}
                className="flex items-center"
              >
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  aria-label="보드 이름"
                  maxLength={40}
                  className="w-28 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </form>
            );
          }

          return (
            <React.Fragment key={board.id}>
              {/* Insertion indicator BEFORE this tab. */}
              <Indicator slot={idx} />

              <div
                className={[
                  "group/tab flex items-center rounded-md transition-opacity",
                  dragging ? "opacity-40" : "opacity-100",
                ].join(" ")}
                onDragOver={
                  canReorder ? (e) => handleDragOverTab(e, idx) : undefined
                }
                // NOTE: drop is handled once at the tablist level (events bubble),
                // so we don't also bind onDrop here — that would fire it twice.
              >
                <button
                  ref={(el) => {
                    tabRefs.current[board.id] = el;
                  }}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  draggable={canReorder}
                  onDragStart={(e) => handleDragStart(e, board)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(board.id)}
                  onDoubleClick={() => onRenameBoard && startRename(board)}
                  onKeyDown={(e) => onKeyDown(e, idx)}
                  title={canReorder ? "드래그하여 순서 변경" : undefined}
                  className={[
                    "relative flex items-center gap-1 whitespace-nowrap rounded-md py-1.5 pl-3 text-sm outline-none transition-colors",
                    // Tighten right padding so the ✕ sits snug; keep room for it.
                    "pr-1.5",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    canReorder ? "cursor-grab active:cursor-grabbing" : "",
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")}
                >
                  {board.isDefault ? (
                    <Star
                      size={12}
                      className="fill-primary text-primary"
                      aria-label="기본 보드"
                    />
                  ) : null}
                  {board.name}
                  {/* Active underline — secondary distinction beyond color/weight. */}
                  <span
                    aria-hidden
                    className={[
                      "pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity",
                      active ? "bg-primary opacity-100" : "opacity-0",
                    ].join(" ")}
                  />
                </button>

                {/* Per-tab ✕ delete — on EVERY tab. Hidden until hover/focus
                    within the tab, but ALWAYS visible on the active tab. The
                    last remaining board can't be deleted (disabled + tooltip). */}
                {onDeleteBoard ? (
                  <button
                    type="button"
                    aria-label={`'${board.name}' 보드 삭제`}
                    title={canDelete ? "보드 삭제" : LAST_BOARD_HINT}
                    disabled={!canDelete}
                    // Don't let a click bubble to tab-select; don't start a drag.
                    onClick={(e) => {
                      e.stopPropagation();
                      requestDelete(board);
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    className={[
                      "ml-0.5 mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded outline-none transition-opacity",
                      "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                      "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-30",
                      // Visibility: always on the active tab; on hover/focus otherwise.
                      active
                        ? "opacity-70 hover:opacity-100"
                        : "opacity-0 group-hover/tab:opacity-70 group-focus-within/tab:opacity-100",
                    ].join(" ")}
                  >
                    <X size={13} />
                  </button>
                ) : null}

                {/* Per-tab actions menu — only on the active tab to keep it tidy. */}
                {active && (onRenameBoard || onDeleteBoard || onSetDefaultBoard) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <IconButton label="보드 메뉴" className="size-7">
                        <MoreVertical size={14} />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {onRenameBoard ? (
                        <DropdownMenuItem
                          icon={<Pencil size={14} />}
                          onClick={() => startRename(board)}
                        >
                          이름 변경
                        </DropdownMenuItem>
                      ) : null}
                      {onSetDefaultBoard ? (
                        <DropdownMenuItem
                          icon={<Check size={14} />}
                          onClick={() => onSetDefaultBoard(board.id)}
                          disabled={board.isDefault}
                        >
                          기본 보드로 설정
                        </DropdownMenuItem>
                      ) : null}
                      {onDeleteBoard ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            icon={<Trash2 size={14} />}
                            onClick={() => requestDelete(board)}
                            disabled={!canDelete}
                            title={canDelete ? undefined : LAST_BOARD_HINT}
                            destructive
                          >
                            삭제
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              {/* Insertion indicator AFTER the last tab. */}
              {idx === boards.length - 1 ? (
                <Indicator slot={boards.length} />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <IconButton label="보드 추가" onClick={onAddBoard} className="size-8">
        <Plus size={16} />
      </IconButton>
    </div>
  );
}

export default BoardTabs;
