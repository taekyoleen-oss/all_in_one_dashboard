"use client";

/**
 * note · ExpandedView — full editor (전체 편집).
 *
 *  An editable title (persisted on change) above the NoteEditor (toolbar + body +
 *  attachments). This is the primary writing surface for lecture notes.
 *
 *  타일에서 소제목을 클릭해 열렸으면(focusSection 핸드오프) 그 섹션만 단독으로
 *  보여주고, '전체 보기' 버튼으로 머리말+전 섹션 화면에 복귀한다. 제목 클릭으로
 *  열렸으면 처음부터 전체 화면이다.
 */

import * as React from "react";
import { ArrowLeft, PanelTopClose } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  useSaveWidgetConfig,
  useCollapseNote,
  useCloseWidgetFocus,
} from "@/lib/widgets/persistence";
import { NoteEditor } from "./NoteEditor";
import {
  clearPendingNoteSection,
  peekPendingNoteSection,
} from "./focusSection";
import type { NoteConfig } from "./types";

export function NoteExpandedView({ config, instanceId }: ExpandedViewProps<NoteConfig>) {
  const save = useSaveWidgetConfig();
  const collapseNote = useCollapseNote();
  const closeFocus = useCloseWidgetFocus();
  const configRef = React.useRef(config);
  // 최신 config 미러 — 렌더 중 ref 쓰기 대신 커밋 후 동기화(react-hooks/refs).
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);
  const timer = React.useRef<number | null>(null);

  // 타일의 소제목 클릭이 예약한 섹션 — peek(순수)로 초기화하고 마운트 후 소거.
  const [sectionId, setSectionId] = React.useState<string | null>(() =>
    peekPendingNoteSection(instanceId),
  );
  React.useEffect(() => {
    clearPendingNoteSection(instanceId);
  }, [instanceId]);
  // 그 사이 섹션이 삭제됐으면(다른 기기 동기화 등) 전체 모드로 폴백.
  const validSectionId =
    sectionId && (config.sections ?? []).some((s) => s.id === sectionId)
      ? sectionId
      : null;

  // '제목만 접기' — 타일을 제목 한 줄로 접고 이 전체보기도 닫는다(한 번에 복귀).
  const collapseToTitle = () => {
    collapseNote(instanceId, "title");
    closeFocus?.();
  };

  const saveTitle = (title: string, debounce: boolean) => {
    if (timer.current != null) window.clearTimeout(timer.current);
    const run = () =>
      save(instanceId, { ...configRef.current, title, updatedAt: Date.now() });
    if (debounce) timer.current = window.setTimeout(run, 500);
    else run();
  };

  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="flex h-[70dvh] min-h-[420px] flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        {validSectionId ? (
          // 단일 섹션 모드에서만 — 머리말+전 섹션 화면으로 전환.
          <button
            type="button"
            onClick={() => setSectionId(null)}
            title="머리말과 모든 소제목 보기"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={14} aria-hidden />
            전체 보기
          </button>
        ) : null}
        <input
          defaultValue={config.title}
          onChange={(e) => saveTitle(e.target.value, true)}
          onBlur={(e) => saveTitle(e.target.value, false)}
          placeholder="노트 제목 (예: 6월 23일 강의)"
          data-pb-no-drag=""
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {/* 제목만 접기: 타일을 제목 한 줄로 접고 전체보기를 닫는다(요구: 전체보기
            에서 바로 제목만). 다시 열 땐 타일의 제목을 클릭. */}
        <button
          type="button"
          onClick={collapseToTitle}
          title="타일을 제목 한 줄로 접고 닫기"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelTopClose size={14} aria-hidden />
          제목만 접기
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <NoteEditor
          config={config}
          instanceId={instanceId}
          sectionId={validSectionId}
        />
      </div>
    </div>
  );
}

export default NoteExpandedView;
