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
import { MoreVertical, Copy, ClipboardPaste, Trash2, Maximize2, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  IconButton,
} from "@/components/ui/primitives";

export interface WidgetMenuProps {
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
}

export function WidgetMenu({
  onCopy,
  onPaste,
  canPaste,
  onDelete,
  onFocus,
  onEdit,
}: WidgetMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {/* data-pb-no-drag: stop the click from being eaten by the drag handle. */}
        <IconButton
          label="위젯 메뉴"
          data-pb-no-drag=""
          onPointerDown={(e) => e.stopPropagation()}
          className="size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/widget:opacity-100"
        >
          <MoreVertical size={16} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem icon={<Maximize2 size={16} />} onClick={onFocus}>
          자세히
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Pencil size={16} />} onClick={onEdit}>
          편집
        </DropdownMenuItem>
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
