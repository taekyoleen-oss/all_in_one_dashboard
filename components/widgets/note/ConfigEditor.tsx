"use client";

/**
 * note · ConfigEditor — title + housekeeping (노트 설정).
 *
 *  The note body is edited in the full view (전체); this dialog sets the title and
 *  offers a "노트 비우기" reset. Reports the whole next config via onChange (parent
 *  persists).
 */

import * as React from "react";
import { Trash2, Share2 } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useSetShareTargetNote } from "@/lib/widgets/persistence";
import type { NoteConfig } from "./types";

export function NoteConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<NoteConfig>) {
  const [confirming, setConfirming] = React.useState(false);
  const setShareTargetNote = useSetShareTargetNote();
  const shareOn = Boolean(config.shareTarget);

  const toggleShare = () => {
    const next = !shareOn;
    // Keep the dialog draft consistent (저장 preserves it) AND apply the
    // cross-instance designation immediately (clears every other note).
    onChange({ ...config, shareTarget: next });
    if (instanceId) setShareTargetNote(instanceId, next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 모바일 공유 받기 — 이 노트를 단일 공유 저장 대상으로 지정 */}
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <button
          type="button"
          role="switch"
          aria-checked={shareOn}
          onClick={toggleShare}
          className="flex items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Share2 size={15} aria-hidden className="shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">공유 받기</span>
              <span className="text-[11px] text-muted-foreground">
                모바일에서 공유한 내용이 이 노트에 저장됩니다.
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={[
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              shareOn ? "bg-primary" : "bg-muted",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block size-4 rounded-full bg-background shadow transition-transform",
                shareOn ? "translate-x-4" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
        </button>
        {shareOn ? (
          <p className="text-[11px] text-muted-foreground">
            다른 노트에서 ‘공유 받기’를 켜면 대상이 그 노트로 옮겨갑니다.
          </p>
        ) : null}
      </div>

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
        본문 작성·서식·이미지·표·파일 첨부와 <b>소제목(섹션) 추가·정리</b>는 위젯의{" "}
        <b>‘전체’</b> 화면에서 할 수 있어요. 붙여넣기(서식 유지)·이미지
        드래그&드롭도 지원합니다.
      </p>

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <span className="text-xs font-medium text-muted-foreground">노트 비우기</span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...config,
                  html: "",
                  attachments: [],
                  sections: [],
                  updatedAt: Date.now(),
                });
                setConfirming(false);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 size={15} aria-hidden /> 본문·소제목·첨부 모두 삭제
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
