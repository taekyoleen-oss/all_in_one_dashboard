"use client";

/**
 * WidgetFrame — the Card-like shell every widget tile lives in (설계서 §7, §8.3).
 *
 *  • Establishes a CSS **container context** (`@container` via container-type:
 *    inline-size) so a widget's CompactView reflows to THIS frame's width, not
 *    the viewport. widget-engineer styles internals with @container queries.
 *  • Provides a header slot: title + an actions placeholder (the per-widget menu
 *    — copy/edit/delete/focus — plugs in here in a later chunk).
 *  • Wraps content in a **per-widget error boundary** so one widget throwing
 *    does not blank the whole canvas; it renders a small inline fallback and the
 *    rest of the board keeps working.
 *
 *  Drag handle contract: the header carries `data-pb-drag-handle`, which
 *  GridCanvas wires to react-grid-layout's drag handle (so dragging grabs the
 *  header, while the body stays interactive).
 */

import * as React from "react";

/* ----------------------------- Error Boundary ----------------------------- */

interface WidgetErrorBoundaryProps {
  title: string;
  children: React.ReactNode;
}
interface WidgetErrorBoundaryState {
  error: Error | null;
}

class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Scoped logging — never leak sensitive widget data to global handlers.
    console.error(`[WidgetFrame] "${this.props.title}" crashed:`, error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex h-full flex-col items-start justify-center gap-2 p-[var(--density-pad)] text-sm"
        >
          <p className="font-medium text-destructive">위젯을 표시할 수 없습니다</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {this.state.error.message || "알 수 없는 오류"}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------- WidgetFrame ------------------------------ */

export interface WidgetFrameProps {
  /** Title shown in the header. */
  title: string;
  /** Optional leading icon node (rendered before the title). */
  icon?: React.ReactNode;
  /**
   * Header actions slot (widget menu / focus button). Placeholder for now —
   * the toolbar/menu chunk fills this in.
   */
  actions?: React.ReactNode;
  /** Widget body — typically a CompactView. */
  children: React.ReactNode;
  /** Extra classes for the outer card. */
  className?: string;
}

export function WidgetFrame({
  title,
  icon,
  actions,
  children,
  className,
}: WidgetFrameProps) {
  return (
    <div
      className={[
        // @container: internal reflow keys off this frame's inline size.
        "@container/widget",
        "group/widget flex h-full w-full flex-col overflow-hidden",
        // Lift the tile off the canvas: stronger border + a layered shadow + a
        // hairline ring so each app reads as a raised card against the bg (요구:
        // 배경과 구분되게 약간 입체감).
        "rounded-[var(--radius)] border border-border bg-card text-card-foreground",
        "shadow-md ring-1 ring-black/5 dark:ring-white/10",
        "transition-shadow duration-200 hover:shadow-lg",
        className ?? "",
      ].join(" ")}
    >
      {/* Header — also the RGL drag handle (see GridCanvas dragConfig.handle). */}
      <header
        data-pb-drag-handle
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-border px-[var(--density-pad)] py-1 active:cursor-grabbing"
      >
        {icon ? (
          <span className="flex size-4 items-center justify-center text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h3>
        {/* Actions placeholder — widget menu plugs in here later. */}
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      </header>

      {/* Body — error-isolated; min-h-0 lets it scroll within the grid cell.
          Overflow scrolls vertically with a THIN (6px) themed scrollbar
          (scrollbar-width:thin for Firefox + ::-webkit-scrollbar for Chromium). */}
      <div
        className={[
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-[var(--density-pad)]",
          "[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]",
          "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
          "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40",
          "[&::-webkit-scrollbar-track]:bg-transparent",
        ].join(" ")}
      >
        <WidgetErrorBoundary title={title}>{children}</WidgetErrorBoundary>
      </div>
    </div>
  );
}

export default WidgetFrame;
