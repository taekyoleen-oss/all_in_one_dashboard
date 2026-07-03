"use client";

/**
 * note · CompactView — read-only preview on the tile (노트 미리보기).
 *
 *  Shows the rendered (sanitized) note body, scrollable. The note TITLE lives in
 *  the widget frame header (config.title via instanceTitle — double-click to
 *  rename, synced across devices), so the tile body has no duplicate title row.
 *  Editing happens in the full view — the WidgetFrame "전체" button opens
 *  NoteEditor. Keeping the tile read-only keeps small tiles clean.
 *
 *  소제목(sections)이 있으면 본문 미리보기 대신 머리말(있을 때) + 소제목 리스트를
 *  보여준다. 소제목 클릭 = 그 섹션만 열기(focusSection 핸드오프 → ExpandedView
 *  단일 섹션 모드), 전체(머리말+전 섹션)는 헤더의 '전체' 버튼.
 */

import * as React from "react";
import { ChevronRight, Paperclip, Plus, Share2 } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import {
  useCollapseNote,
  useOpenWidgetFocus,
  useSaveWidgetConfig,
} from "@/lib/widgets/persistence";
import type { NoteCollapseLevel } from "./collapseLayout";
import { sanitizeHtml, htmlToText } from "./sanitize";
import { NOTE_PROSE_CLASS } from "./prose";
import { createSection } from "./sections";
import { setPendingNoteSection } from "./focusSection";
import type { NoteConfig } from "./types";

/** uSES mounted 게이트용 no-op 구독(항상 동일 참조). */
const emptySubscribe = () => () => {};

/**
 * 접기 토글 — 노트 타일 본문 상단의 3분할 컨트롤(펼침 | 절반 | 제목만).
 *  • 펼침(normal)  = 사용자가 설정한 높이 그대로(기본). 드래그로 자유롭게 조절.
 *  • 절반(more)    = 그 높이의 절반으로 접어 아래 위젯이 올라옴.
 *  • 제목만(title) = 제목 한 줄 높이(최소)로 접음 — 일기·긴 기록용. 제목 클릭이
 *                    곧 '전체' 열기라 내용 확인·복귀가 한 클릭이다.
 * collapseNote가 실제 그리드 h를 바꾸므로(세로 컴팩션) 이웃 위젯이 따라 이동한다.
 */
function CollapseToggle({
  instanceId,
  level,
}: {
  instanceId: string;
  level: NoteCollapseLevel;
}) {
  const collapseNote = useCollapseNote();
  const seg = (active: boolean) =>
    [
      "rounded px-1.5 py-0.5 text-[11px] font-medium leading-none transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground",
    ].join(" ");
  const items: Array<{ key: NoteCollapseLevel; label: string }> = [
    { key: "normal", label: "펼침" },
    { key: "more", label: "절반" },
    { key: "title", label: "제목만" },
  ];
  return (
    <div
      className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="노트 접기"
      // 본문 영역이라 드래그 핸들은 아니지만, 클릭이 상위로 새어 그리드 상호작용을
      // 건드리지 않도록 포인터 이벤트를 여기서 멈춘다.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={() => collapseNote(instanceId, it.key)}
          aria-pressed={level === it.key}
          className={seg(level === it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function NoteCompactView({
  config,
  instanceId,
}: CompactViewProps<NoteConfig>) {
  // Render the HTML preview only after mount: sanitizeHtml is DOM-based, so its
  // result differs between SSR (regex fallback) and the client — gating on mount
  // avoids a hydration mismatch. (uSES 서버/클라 스냅샷 분기 = 권장 mounted 패턴)
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const openFocus = useOpenWidgetFocus();
  const save = useSaveWidgetConfig();
  const level: NoteCollapseLevel =
    config.collapse === "more" || config.collapse === "title"
      ? config.collapse
      : "normal";
  const titleOnly = level === "title";

  const safe = React.useMemo(() => sanitizeHtml(config.html), [config.html]);
  const isEmpty = htmlToText(config.html).length === 0;
  const sections = config.sections ?? [];
  const hasSections = sections.length > 0;

  /** 소제목 클릭 → 다음 전체보기가 그 섹션만 열도록 예약 후 오버레이 오픈. */
  const openSection = (sectionId: string) => {
    if (!openFocus) return;
    setPendingNoteSection(instanceId, sectionId);
    openFocus(instanceId);
  };

  /**
   * 타일에서 바로 소제목 추가 — 빈 섹션을 만들어 저장하고, 그 섹션 단독 편집
   * 화면(전체보기 단일 섹션 모드)을 바로 연다(소제목·내용을 즉시 입력).
   * 전체보기 하단 버튼과 동일 동작의 두 번째 진입점(발견성).
   */
  const addSection = () => {
    if (!openFocus) return;
    const s = createSection(crypto.randomUUID());
    save(instanceId, {
      ...config,
      sections: [...sections, s],
      updatedAt: Date.now(),
    });
    setPendingNoteSection(instanceId, s.id);
    openFocus(instanceId);
  };

  /** '＋ 소제목' 타일 버튼(공용) — 섹션 리스트 아래·본문 아래 두 자리에서 사용. */
  const addSectionButton = openFocus ? (
    <button
      type="button"
      data-pb-no-drag=""
      onPointerDown={(e) => e.stopPropagation()}
      onClick={addSection}
      title="소제목을 추가하고 바로 입력"
      className="inline-flex w-fit shrink-0 items-center gap-1 rounded px-1 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus size={12} aria-hidden /> 소제목
    </button>
  ) : null;

  return (
    <div className="flex h-full w-full flex-col gap-1.5">
      {/* 상단 컨트롤 줄 — 제목은 위젯 프레임 헤더 한 곳(config.title과 동기화,
          더블클릭 변경)이라 여기엔 상태 아이콘과 접기 토글만 남긴다. 전체보기
          진입은 헤더의 '전체' 버튼·소제목 클릭. */}
      <div className="flex shrink-0 items-center gap-1.5">
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
        <CollapseToggle instanceId={instanceId} level={level} />
      </div>

      {titleOnly ? (
        // '제목만' — 본문을 아예 렌더하지 않아 타일이 헤더(제목)+토글 줄로 최소화
        // 된다. 내용은 헤더의 '전체' 버튼으로 확인.
        null
      ) : hasSections ? (
        // 소제목 리스트 — 같은 분류의 기록을 목차처럼. 머리말(본문)이 있으면 위에
        // 미리보기(mounted 게이트, 살균 HTML), 소제목 제목은 평문이라 SSR 안전.
        <div className="min-h-0 flex-1 overflow-y-auto pb-scroll">
          {mounted && !isEmpty ? (
            <div
              className={`mb-1.5 text-sm ${NOTE_PROSE_CLASS}`}
              // Sanitized at write-time AND here at render-time (defense in depth).
              dangerouslySetInnerHTML={{ __html: safe }}
            />
          ) : null}
          <ul className="flex flex-col">
            {sections.map((s) => (
              <li key={s.id}>
                {openFocus ? (
                  <button
                    type="button"
                    data-pb-no-drag=""
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => openSection(s.id)}
                    title="클릭하여 이 소제목만 보기"
                    className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-sm text-foreground outline-none transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight
                      size={12}
                      aria-hidden
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {s.title || "제목 없는 소제목"}
                    </span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 px-1 py-1 text-sm text-foreground">
                    <ChevronRight
                      size={12}
                      aria-hidden
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {s.title || "제목 없는 소제목"}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {addSectionButton}
        </div>
      ) : !mounted ? (
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

      {/* 소제목이 아직 없는 노트에도 첫 소제목 진입점을 노출(발견성) — '제목만'
          접기에선 본문과 함께 숨긴다. 섹션이 있으면 리스트 아래에서 렌더됨. */}
      {titleOnly || hasSections ? null : addSectionButton}
    </div>
  );
}

export default NoteCompactView;
