"use client";

/**
 * ============================================================================
 *  Toolbar — minimal, hideable canvas controls (설계서 §3 툴바)
 * ============================================================================
 *
 *  Ghost icon buttons (36px touch targets):
 *    • 편집/잠금  — flips GridCanvas drag+resize enabled (edit ⇄ locked)
 *    • 정리하기   — re-compaction of the current board (verticalCompactor)
 *    • 팔레트     — show/hide the desktop palette sidebar
 *    • 테마       — dark ⇄ light via data-theme on <html>
 *
 *  The toolbar itself is collapsible (a chevron hides the button row to maximize
 *  canvas) — "hideable toolbar" per spec.
 * ============================================================================
 */

import * as React from "react";
import {
  Lock,
  Unlock,
  Sparkles,
  PanelLeft,
  Sun,
  Moon,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { IconButton } from "@/components/ui/primitives";

export type ThemeMode = "dark" | "light";

export interface ToolbarProps {
  /** Edit mode on ⇒ drag/resize enabled. */
  editable: boolean;
  onToggleEditable: () => void;
  /** Run a compaction pass on the active board. */
  onCompact: () => void;
  /** Desktop palette visibility (collapsed = hidden). */
  paletteCollapsed: boolean;
  onTogglePalette: () => void;
  /** Current theme + setter (applied to <html data-theme>). */
  theme: ThemeMode;
  onToggleTheme: () => void;
  /** Open the settings dialog (앱 표시 / 계정). */
  onOpenSettings: () => void;
}

export function Toolbar({
  editable,
  onToggleEditable,
  onCompact,
  paletteCollapsed,
  onTogglePalette,
  theme,
  onToggleTheme,
  onOpenSettings,
}: ToolbarProps) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card/40 p-1">
      <IconButton
        label={open ? "툴바 숨기기" : "툴바 보이기"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </IconButton>

      {open && (
        <>
          <div className="mx-0.5 h-5 w-px bg-border" aria-hidden />

          <IconButton
            label={editable ? "잠금 (이동·크기 조절 끄기)" : "편집 (이동·크기 조절 켜기)"}
            active={!editable}
            onClick={onToggleEditable}
          >
            {editable ? <Unlock size={16} /> : <Lock size={16} />}
          </IconButton>

          <IconButton label="재정렬 (한 화면에 맞추기)" onClick={onCompact}>
            <Sparkles size={16} />
          </IconButton>

          {/* 데스크톱(lg+) 전용 — 모바일/태블릿은 팔레트 FAB을 쓴다. IconButton의
              base `inline-flex`가 `hidden`을 이겨 모바일에서 토글이 새던 문제가 있어,
              디스플레이 충돌이 없는 span으로 감싸 가시성을 제어한다(lg:contents). */}
          <span className="hidden lg:contents">
            <IconButton
              label={paletteCollapsed ? "팔레트 보이기" : "팔레트 숨기기"}
              active={!paletteCollapsed}
              onClick={onTogglePalette}
            >
              <PanelLeft size={16} />
            </IconButton>
          </span>

          <IconButton
            label={theme === "dark" ? "라이트 모드" : "다크 모드"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>

          <IconButton label="설정 (앱 표시·계정)" onClick={onOpenSettings}>
            <Settings size={16} />
          </IconButton>
        </>
      )}
    </div>
  );
}

export default Toolbar;
