"use client";

/**
 * note · ConfigEditor — title + housekeeping (노트 설정).
 *
 *  The note body is edited in the full view (전체); this dialog sets the title and
 *  offers a "노트 비우기" reset. Reports the whole next config via onChange (parent
 *  persists).
 */

import * as React from "react";
import { Trash2 } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { NoteConfig } from "./types";

export function NoteConfigEditor({ config, onChange }: ConfigEditorProps<NoteConfig>) {
  const [confirming, setConfirming] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        노트 제목
        <input
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="예: 6월 23일 강의"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <p className="text-[11px] text-muted-foreground">
        본문 작성·서식·이미지·표·파일 첨부는 위젯의 <b>‘전체’</b> 화면에서 할 수 있어요.
        붙여넣기(서식 유지)·이미지 드래그&드롭도 지원합니다.
      </p>

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <span className="text-xs font-medium text-muted-foreground">노트 비우기</span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({ ...config, html: "", attachments: [], updatedAt: Date.now() });
                setConfirming(false);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 size={15} aria-hidden /> 본문·첨부 모두 삭제
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex w-fit items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={15} aria-hidden /> 노트 내용 비우기
          </button>
        )}
      </div>
    </div>
  );
}

export default NoteConfigEditor;
