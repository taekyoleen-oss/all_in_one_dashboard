"use client";

/**
 * ============================================================================
 *  WidgetMenu — per-widget actions (설계서 §3 위젯 메뉴)
 * ============================================================================
 *
 *  Lives in the WidgetFrame `actions` slot. Provides:
 *    복사 / 붙여넣기 / 삭제 / 자세히(focus) / 편집 / 잠금
 *
 *  • 복사      → copies { type, config } to the app clipboard (lib/utils/clipboard)
 *  • 붙여넣기  → appends a new instance from the clipboard (parent does the work)
 *  • 자세히    → openOverlay('focus:'+instanceId) so Back closes focus only (§6.3)
 *  • 편집      → opens the ConfigEditor dialog (parent owns the dialog + persist)
 *  • 잠금      → per-instance lock placeholder (board-level lock lives in Toolbar)
 *
 *  The trigger has [data-pb-no-drag] so opening the menu never starts a grid
 *  drag (the menu sits inside the draggable header).
 * ============================================================================
 */

import * as React from "react";
import {
  MoreVertical,
  Copy,
  ClipboardPaste,
  Trash2,
  Maximize2,
  Pencil,
  Minus,
  Plus,
  TextCursorInput,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
} from "@/components/ui/primitives";
import {
  usePersistedFontScale,
  MIN_SCALE,
  MAX_SCALE,
} from "@/lib/utils/fontScale";
import { usePersistedColor, PASTEL_COLORS } from "@/lib/utils/widgetColor";

export interface WidgetMenuProps {
  /** This instance's id — keys the per-widget 글자 크기 (font scale). */
  instanceId: string;
  /** Copy this widget's { type, config } to the app clipboard. */
  onCopy: () => void;
  /** Paste a new instance from the clipboard (disabled when clipboard empty). */
  onPaste: () => void;
  /** Whether the clipboard currently holds something to paste. */
  canPaste: boolean;
  /** Delete this instance. */
  onDelete: () => void;
  /** Enter focus (자세히) mode for this instance. */
  onFocus: () => void;
  /** Open the edit (ConfigEditor) dialog. */
  onEdit: () => void;
  /** 헤더 제목 인라인 편집 열기(제목 변경). */
  onRename?: () => void;
}

export function WidgetMenu({
  instanceId,
  onCopy,
  onPaste,
  canPaste,
  onDelete,
  onFocus,
  onEdit,
  onRename,
}: WidgetMenuProps) {
  const { scale, inc, dec, reset } = usePersistedFontScale(instanceId);
  const { color, setColor } = usePersistedColor(instanceId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {/* data-pb-no-drag: stop the click from being eaten by the drag handle. */}
        <IconButton
          label="위젯 메뉴"
          data-pb-no-drag=""
          onPointerDown={(e) => e.stopPropagation()}
          // Desktop (fine pointer): reveal on hover/focus to keep tiles clean.
          // Touch (coarse pointer): there is no hover, so the button must be
          // ALWAYS visible — otherwise the ⋮ menu is invisible & unusable on
          // phones/tablets. pointer-coarse pins it to full opacity.
          className="size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/widget:opacity-100 pointer-coarse:opacity-100"
        >
          <MoreVertical size={16} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* 글자 크기 — A−/리셋/A+. These are plain buttons (not menu items), so
            clicking them does NOT close the menu; you can tap several times. */}
        <div
          role="group"
          aria-label="글자 크기"
          data-pb-no-drag=""
          className="flex items-center justify-between gap-2 px-2 py-1.5"
        >
          <span className="text-sm text-popover-foreground">글자 크기</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="글자 작게"
              disabled={scale <= MIN_SCALE}
              onClick={dec}
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <button
              type="button"
              aria-label="기본 글자 크기로"
              onClick={reset}
              className="min-w-12 rounded-sm px-1 text-center text-xs tabular-nums text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              aria-label="글자 크게"
              disabled={scale >= MAX_SCALE}
              onClick={inc}
              className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {/* 앱 색 — 파스텔 스와치. Plain buttons (not menu items) so the menu stays
            open while trying colors. Selected swatch gets a ring. */}
        <div
          role="group"
          aria-label="앱 색"
          data-pb-no-drag=""
          className="flex flex-col gap-1.5 px-2 py-1.5"
        >
          <span className="text-sm text-popover-foreground">앱 색</span>
          <div className="grid grid-cols-6 gap-1">
            {PASTEL_COLORS.map((opt) => {
              const selected = (color ?? null) === opt.value;
              return (
                <button
                  key={opt.name}
                  type="button"
                  aria-label={opt.name}
                  aria-pressed={selected}
                  title={opt.name}
                  onClick={() => setColor(opt.value)}
                  style={
                    opt.value ? { backgroundColor: opt.value } : undefined
                  }
                  className={[
                    "size-6 rounded-full border outline-none transition-transform",
                    "hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
                    opt.value ? "border-black/10" : "border-border bg-card",
                    selected ? "ring-2 ring-ring ring-offset-1 ring-offset-popover" : "",
                  ].join(" ")}
                >
                  {!opt.value ? (
                    <span className="text-[9px] text-muted-foreground">기본</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Maximize2 size={16} />} onClick={onFocus}>
          자세히
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Pencil size={16} />} onClick={onEdit}>
          편집
        </DropdownMenuItem>
        {onRename ? (
          <DropdownMenuItem
            icon={<TextCursorInput size={16} />}
            onClick={onRename}
          >
            제목 변경
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Copy size={16} />} onClick={onCopy}>
          복사
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<ClipboardPaste size={16} />}
          onClick={onPaste}
          disabled={!canPaste}
        >
          붙여넣기
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={<Trash2 size={16} />}
          onClick={onDelete}
          destructive
        >
          삭제
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WidgetMenu;
