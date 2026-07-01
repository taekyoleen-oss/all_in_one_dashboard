"use client";

/**
 * clipboard · ExpandedView — full clipboard history (focus mode).
 *
 *  Search, a paste-to-add box, add-from-clipboard, per-entry re-copy + delete,
 *  timestamps, and clear-all. Same per-instance localStorage store as compact;
 *  auto-capture keeps recording page copies while open.
 */

import * as React from "react";
import { Check, Copy, Trash2, ClipboardPlus, Search } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  useClipboardHistory,
  useCopyCapture,
  copyText,
  readClipboardText,
} from "./useClipboardHistory";
import { DEVICE_META, type ClipboardConfig } from "./types";

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClipboardExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<ClipboardConfig>) {
  const { items, add, remove, clear } = useClipboardHistory(
    instanceId,
    config.maxItems,
  );
  useCopyCapture(config.captureOnCopy !== false, add);

  const [query, setQuery] = React.useState("");
  const [pasteText, setPasteText] = React.useState("");
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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.text.toLowerCase().includes(q))
    : items;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3">
      {/* Add controls */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(pasteText);
                setPasteText("");
              }
            }}
            placeholder="여기에 붙여넣기(Ctrl+V) 후 Enter — 직접 기록에 추가"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={addFromClipboard}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClipboardPlus size={15} aria-hidden />
            클립보드에서 추가
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          이 페이지에서 복사한 텍스트는 자동 기록됩니다. 윈도우 등 다른 곳에서 복사한
          내용은 ‘클립보드에서 추가’를 누르거나 위 칸에 붙여넣어 추가하세요.
        </p>
      </div>

      {/* Search + clear */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="기록 검색"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (items.length > 0 && window.confirm("기록을 모두 지울까요?")) clear();
          }}
          disabled={items.length === 0}
          className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          전체 지우기
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {items.length === 0 ? "기록이 없습니다." : "검색 결과가 없습니다."}
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
          {filtered.map((it) => (
            <li
              key={it.id}
              style={{ borderLeft: `3px solid ${DEVICE_META[it.device].color}` }}
              className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-2"
            >
              <button
                type="button"
                onClick={() => recopy(it.id, it.text)}
                title="클릭하면 다시 복사"
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left outline-none"
              >
                <span className="line-clamp-3 w-full whitespace-pre-wrap break-words text-sm text-foreground">
                  {it.text}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: DEVICE_META[it.device].color }}
                  />
                  <span style={{ color: DEVICE_META[it.device].color }}>
                    {DEVICE_META[it.device].label}
                  </span>
                  · {formatWhen(it.ts)}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => recopy(it.id, it.text)}
                  aria-label="다시 복사"
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copiedId === it.id ? (
                    <Check size={15} className="text-positive" />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  aria-label="삭제"
                  className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ClipboardExpandedView;
