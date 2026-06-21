"use client";

/**
 * stock · RefreshBar — "결과 시각 + 새로고침" row shown at the top of the stock
 * widget body (right under the frame title). The button forces an immediate
 * snapshot fetch; the label shows when the currently-displayed data arrived.
 * Refreshing reuses the server-side cached KIS token, so it never re-issues a
 * token (no KakaoTalk push per refresh).
 */

import * as React from "react";
import { RotateCw } from "lucide-react";
import { formatUpdatedTime } from "./format";

export function RefreshBar({
  lastUpdated,
  onRefresh,
  size = "compact",
}: {
  lastUpdated: number | null;
  onRefresh: () => Promise<void> | void;
  size?: "compact" | "expanded";
}) {
  const [busy, setBusy] = React.useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };
  const textCls = size === "compact" ? "text-[10px]" : "text-xs";
  const icon = size === "compact" ? 12 : 14;
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-2 ${textCls} text-muted-foreground`}
    >
      <span className="truncate">
        {lastUpdated ? `${formatUpdatedTime(lastUpdated)} 기준` : "불러오는 중…"}
      </span>
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        aria-label="새로고침"
        title="새로고침"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
