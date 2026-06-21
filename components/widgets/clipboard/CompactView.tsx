"use client";

/**
 * clipboard · CompactView — recent copied texts on the canvas tile.
 *
 *  Auto-captures text copied on the page (config.captureOnCopy) and lists recent
 *  entries; clicking an entry re-copies it to the OS clipboard (✓ feedback). A
 *  "추가" button grabs the current OS clipboard on demand. State is per-instance
 *  (localStorage). Reflows by @container; isolated by instanceId.
 */

import * as React from "react";
import { Check, Copy, ClipboardPlus } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import {
  useClipboardHistory,
  useCopyCapture,
  useClipboardAutoCapture,
  copyText,
  readClipboardText,
} from "./useClipboardHistory";
import type { ClipboardConfig } from "./types";

export function ClipboardCompactView({
  config,
  instanceId,
}: CompactViewProps<ClipboardConfig>) {
  const { items, add } = useClipboardHistory(instanceId, config.maxItems);
  const capture = config.captureOnCopy !== false;
  useCopyCapture(capture, add);
  // Auto-record OS clipboard when returning to the app (Ctrl+C elsewhere → here).
  useClipboardAutoCapture(capture, add);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const recopy = React.useCallback(async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1200);
    }
  }, []);

  const addFromClipboard = React.useCallback(async () => {
    const t = await readClipboardText();
    if (t) add(t);
  }, [add]);

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          복사 기록 {items.length > 0 ? `(${items.length})` : ""}
        </span>
        <button
          type="button"
          onClick={addFromClipboard}
          title="현재 클립보드 추가"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClipboardPlus size={12} aria-hidden />
          추가
        </button>
      </div>

      {items.length === 0 ? (
        <p className="flex-1 text-xs text-muted-foreground">
          복사한 텍스트가 여기에 기록됩니다. 항목을 누르면 다시 복사돼요.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-scroll">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => recopy(it.id, it.text)}
                title="클릭하면 다시 복사"
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {it.text}
                </span>
                {copiedId === it.id ? (
                  <Check size={12} className="shrink-0 text-positive" aria-label="복사됨" />
                ) : (
                  <Copy
                    size={12}
                    className="shrink-0 text-muted-foreground/50"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ClipboardCompactView;
