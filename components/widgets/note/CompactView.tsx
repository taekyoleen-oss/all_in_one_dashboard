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
import { sanitizeHtml, htmlToText } from "./sanitize";
import { NOTE_PROSE_CLASS } from "./NoteEditor";
import type { NoteConfig } from "./types";

export function NoteCompactView({ config }: CompactViewProps<NoteConfig>) {
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
        <span className="truncate text-sm font-semibold text-foreground">
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
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
            <Paperclip size={11} aria-hidden /> {config.attachments.length}
          </span>
        ) : null}
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
