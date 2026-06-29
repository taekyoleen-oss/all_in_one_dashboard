"use client";

/**
 * note · CompactView — read-only preview on the tile (노트 미리보기).
 *
 *  Shows the title + rendered (sanitized) note body, scrollable. Editing happens
 *  in the full view — the WidgetFrame "전체" button opens NoteEditor. Keeping the
 *  tile read-only keeps small tiles clean and avoids a heavy editor per tile.
 */

import * as React from "react";
import { NotebookPen, Paperclip, Share2 } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useCollapseNote } from "@/lib/widgets/persistence";
import { sanitizeHtml, htmlToText } from "./sanitize";
import { NOTE_PROSE_CLASS } from "./NoteEditor";
import type { NoteConfig } from "./types";

/**
 * 접기 토글 — 노트 타일 본문 상단의 2분할 컨트롤(접기 | 더접기).
 *  • 접기(normal) = 사용자가 설정한 높이 그대로(기본). 드래그로 자유롭게 조절.
 *  • 더접기(more) = 그 높이의 절반으로 접어 아래 위젯이 올라옴.
 * collapseNote가 실제 그리드 h를 바꾸므로(세로 컴팩션) 이웃 위젯이 따라 이동한다.
 */
function CollapseToggle({
  instanceId,
  level,
}: {
  instanceId: string;
  level: "normal" | "more";
}) {
  const collapseNote = useCollapseNote();
  const seg = (active: boolean) =>
    [
      "rounded px-1.5 py-0.5 text-[11px] font-medium leading-none transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground",
    ].join(" ");
  return (
    <div
      className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="노트 접기"
      // 본문 영역이라 드래그 핸들은 아니지만, 클릭이 상위로 새어 그리드 상호작용을
      // 건드리지 않도록 포인터 이벤트를 여기서 멈춘다.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => collapseNote(instanceId, "normal")}
        aria-pressed={level === "normal"}
        className={seg(level === "normal")}
      >
        접기
      </button>
      <button
        type="button"
        onClick={() => collapseNote(instanceId, "more")}
        aria-pressed={level === "more"}
        className={seg(level === "more")}
      >
        더접기
      </button>
    </div>
  );
}

export function NoteCompactView({
  config,
  instanceId,
}: CompactViewProps<NoteConfig>) {
  // Render the HTML preview only after mount: sanitizeHtml is DOM-based, so its
  // result differs between SSR (regex fallback) and the client — gating on mount
  // avoids a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const safe = React.useMemo(() => sanitizeHtml(config.html), [config.html]);
  const isEmpty = htmlToText(config.html).length === 0;

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      <div className="flex shrink-0 items-center gap-1.5">
        <NotebookPen size={14} aria-hidden className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {config.title || "제목 없는 노트"}
        </span>
        {config.shareTarget ? (
          <Share2
            size={12}
            aria-label="공유 받기 대상"
            className="shrink-0 text-primary"
          />
        ) : null}
        {config.attachments.length > 0 ? (
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
            <Paperclip size={11} aria-hidden /> {config.attachments.length}
          </span>
        ) : null}
        <CollapseToggle
          instanceId={instanceId}
          level={config.collapse === "more" ? "more" : "normal"}
        />
      </div>

      {!mounted ? (
        // Server + first client render are identical (htmlToText/sanitizeHtml are
        // DOM-based) — defer the content branch to after mount.
        <div className="min-h-0 flex-1" aria-hidden />
      ) : isEmpty ? (
        <p className="my-auto text-center text-xs text-muted-foreground">
          ‘전체’를 눌러 강의 내용을 기록하세요.
        </p>
      ) : (
        <div
          className={`min-h-0 flex-1 overflow-y-auto pb-scroll text-sm ${NOTE_PROSE_CLASS}`}
          // Sanitized at write-time AND here at render-time (defense in depth).
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      )}
    </div>
  );
}

export default NoteCompactView;
