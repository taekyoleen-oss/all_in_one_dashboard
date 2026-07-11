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
import { Check, Copy, ClipboardPlus, Star, Trash2 } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import {
  useClipboardHistory,
  useCopyCapture,
  useClipboardAutoCapture,
  copyText,
  readClipboardText,
} from "./useClipboardHistory";
import { DEVICE_META, isSameLocalDay, type ClipboardConfig } from "./types";

export function ClipboardCompactView({
  config,
  instanceId,
}: CompactViewProps<ClipboardConfig>) {
  const { items, add, remove, toggleFav } = useClipboardHistory(
    instanceId,
    config.maxItems,
  );
  const capture = config.captureOnCopy !== false;
  useCopyCapture(capture, add);
  // Auto-record OS clipboard when returning to the app (Ctrl+C elsewhere → here).
  useClipboardAutoCapture(capture, add);
  // 오늘 복사한 항목 강조 — 분 단위 틱으로 자정이 지나면 강조가 자연 해제된다.
  const now = useNow(60_000);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  // 삭제는 실수 방지 위해 2단계(휴지통 → '삭제?' 재확인). 기기 간 공유 저장이라
  // 지우면 PC·모바일 모두에서 사라진다.
  const [confirmDelId, setConfirmDelId] = React.useState<string | null>(null);
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
          {items.map((it) => {
            // 강조 규칙: 즐겨찾기 = 오늘과 같은 형태(2단계 큰 글씨·bold)이되 파란색,
            // 오늘 복사 = 2단계 큰 글씨·bold(기본색), 그 외 = 평소 크기.
            const isToday = isSameLocalDay(it.ts, now.getTime());
            const textCls = it.fav
              ? "text-base font-bold text-blue-500"
              : isToday
                ? "text-base font-bold text-foreground"
                : "text-xs text-foreground";
            return (
            <li
              key={it.id}
              className="flex items-center gap-0.5 rounded-md transition-colors hover:bg-accent"
            >
              <button
                type="button"
                onClick={() => recopy(it.id, it.text)}
                title="클릭하면 다시 복사"
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left outline-none focus-visible:bg-accent focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  title={`${DEVICE_META[it.device].label}에서 복사`}
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: DEVICE_META[it.device].color }}
                />
                <span className={`min-w-0 flex-1 truncate ${textCls}`}>
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
              <button
                type="button"
                onClick={() => toggleFav(it.id, !it.fav)}
                title={it.fav ? "즐겨찾기 해제" : "즐겨찾기"}
                aria-label={it.fav ? "즐겨찾기 해제" : "즐겨찾기"}
                aria-pressed={it.fav}
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${
                  it.fav
                    ? "text-blue-500"
                    : "text-muted-foreground/50 hover:text-blue-500"
                }`}
              >
                <Star size={12} fill={it.fav ? "currentColor" : "none"} aria-hidden />
              </button>
              {confirmDelId === it.id ? (
                <button
                  type="button"
                  onClick={() => {
                    remove(it.id);
                    setConfirmDelId(null);
                  }}
                  title="한 번 더 눌러 삭제"
                  aria-label="삭제 확인"
                  className="shrink-0 rounded-md px-1 py-0.5 text-[10px] font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  삭제?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelId(it.id);
                    window.setTimeout(
                      () => setConfirmDelId((c) => (c === it.id ? null : c)),
                      2500,
                    );
                  }}
                  title="삭제"
                  aria-label="삭제"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default ClipboardCompactView;
