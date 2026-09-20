"use client";

/**
 * note · ConfigEditor — title + housekeeping (노트 설정).
 *
 *  The note body is edited in the full view (전체); this dialog sets the title and
 *  offers a "노트 비우기" reset. Reports the whole next config via onChange (parent
 *  persists).
 */

import * as React from "react";
import { Trash2, Share2, Smartphone } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useSetExclusiveNoteFlag } from "@/lib/widgets/persistence";
import type { NoteConfig } from "./types";

export function NoteConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<NoteConfig>) {
  const [confirming, setConfirming] = React.useState(false);
  const setNoteFlag = useSetExclusiveNoteFlag();
  const shareOn = Boolean(config.shareTarget);
  const mobileOn = Boolean(config.mobileSync);

  // 폰 노트 위젯이 볼 노트 **선택**. 켜면 다른 노트의 지정은 자동으로 풀린다
  // (공유 받기와 같은 배타 규칙) — 항상 정확히 한 노트만 폰과 연결된다.
  // 즉시 영속이라 '저장' 없이 닫아도 유지된다.
  const toggleMobile = () => {
    const next = !mobileOn;
    onChange({
      ...config,
      mobileSync: next,
      ...(next ? { mobileSyncAt: Date.now() } : { mobileSyncAt: undefined }),
    });
    if (instanceId) setNoteFlag(instanceId, "mobileSync", next);
  };

  const toggleShare = () => {
    const next = !shareOn;
    // Keep the dialog draft consistent (저장 preserves it) AND apply the
    // cross-instance designation immediately (clears every other note).
    onChange({ ...config, shareTarget: next });
    if (instanceId) setNoteFlag(instanceId, "shareTarget", next);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 폰 홈 화면 노트 위젯이 볼 노트 지정 — 이 노트의 소제목이 그쪽 목록이 된다 */}
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <button
          type="button"
          role="switch"
          aria-checked={mobileOn}
          onClick={toggleMobile}
          className="flex items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Smartphone size={15} aria-hidden className="shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                모바일 홈 화면에 표시
              </span>
              <span className="text-[11px] text-muted-foreground">
                이 노트의 <b>소제목</b>이 안드로이드 홈 화면 &lsquo;노트&rsquo; 위젯에
                목록으로 나오고, 폰에서 열람·추가·삭제한 것이 이 노트에 반영됩니다.
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={[
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              mobileOn ? "bg-primary" : "bg-muted",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block size-4 rounded-full bg-background shadow transition-transform",
                mobileOn ? "translate-x-4" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
        </button>
        <p className="text-[11px] text-muted-foreground">
          폰과 연결되는 노트는 <b>하나</b>입니다 — 다른 노트에서 켜면 대상이 그쪽으로
          옮겨갑니다. 폰에서는 이미지·표가 든 소제목의 본문을 고칠 수 없습니다
          (이름 변경·삭제는 됩니다).
        </p>
      </div>

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
        본문 작성·서식·이미지·표·파일 첨부와 <b>소제목(섹션) 추가·정리</b>는 메뉴의{" "}
        <b>‘편집’</b>(전체 화면)에서 할 수 있어요. 붙여넣기(서식 유지)·이미지
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
