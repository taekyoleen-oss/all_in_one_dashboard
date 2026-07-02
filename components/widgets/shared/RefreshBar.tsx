"use client";

/**
 * RefreshBar — shared "갱신 시각 + 새로고침" row for poll-mode widgets
 * (날씨·환율 등). Shows when the displayed data last updated and a button to
 * fetch now. `onRefresh` may be sync (usePoll.refresh) or async; the icon spins
 * briefly for feedback regardless.
 */

import * as React from "react";
import { RotateCw } from "lucide-react";

function formatTime(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RefreshBar({
  lastUpdated,
  onRefresh,
  size = "compact",
}: {
  lastUpdated: number | null;
  onRefresh: () => void | Promise<void>;
  size?: "compact" | "expanded";
}) {
  const [busy, setBusy] = React.useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      // usePoll.refresh is fire-and-forget; spin briefly so the tap registers.
      window.setTimeout(() => setBusy(false), 600);
    }
  };
  const textCls = size === "compact" ? "text-[10px]" : "text-xs";
  const icon = size === "compact" ? 12 : 14;
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-2 ${textCls} text-muted-foreground`}
    >
      <span className="truncate">
        {lastUpdated ? `${formatTime(lastUpdated)} 기준` : "불러오는 중…"}
      </span>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        aria-label="새로고침"
        title="새로고침"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:size-9"
      >
        <RotateCw
          size={icon}
          className={busy ? "animate-spin motion-reduce:animate-none" : undefined}
          aria-hidden
        />
      </button>
    </div>
  );
}

export default RefreshBar;
