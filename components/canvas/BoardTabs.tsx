"use client";

/**
 * ============================================================================
 *  BoardTabs — multi-board switcher (설계서 §3 보드 탭)
 * ============================================================================
 *
 *  Tabs for each board (업무 / 투자 / 개인 …) plus a `+` to add one. Switching a
 *  tab swaps the active board's instances + layout. Each board is backed by a
 *  `pb_dashboards` row; the active board's id/name/is_default/sort_order are
 *  persisted via the usePersistence hook in CanvasShell.
 *
 *  Per-tab actions (right-aligned ⋮ menu, shown for the active tab):
 *    • 이름 변경 — inline rename (renameBoard)
 *    • 기본 보드로 설정 — setDefaultBoard (single-default invariant)
 *    • 삭제 — deleteBoard (disabled when only one board remains)
 *
 *  Accessibility: a proper `role="tablist"` with arrow-key roving focus and
 *  aria-selected; the active tab is distinguished by underline + weight + a
 *  small ★ on the default board.
 * ============================================================================
 */

import * as React from "react";
import { Plus, Star, MoreVertical, Pencil, Trash2, Check } from "lucide-react";
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
}

export function BoardTabs({
  boards,
  activeId,
  onSelect,
  onAddBoard,
  onRenameBoard,
  onDeleteBoard,
  onSetDefaultBoard,
}: BoardTabsProps) {
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  // Inline-rename state: which board id is being renamed (null = none).
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [draftName, setDraftName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (renamingId) return;
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

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <div role="tablist" aria-label="보드" className="flex items-center gap-1">
        {boards.map((board, idx) => {
          const active = board.id === activeId;
          const renaming = renamingId === board.id;

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
            <div key={board.id} className="flex items-center">
              <button
                ref={(el) => {
                  tabRefs.current[board.id] = el;
                }}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onSelect(board.id)}
                onDoubleClick={() => onRenameBoard && startRename(board)}
                onKeyDown={(e) => onKeyDown(e, idx)}
                className={[
                  "relative flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring",
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
                          onClick={() => onDeleteBoard(board.id)}
                          disabled={!canDelete}
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
