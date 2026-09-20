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
import { ArrowLeft, PanelTopClose, Smartphone } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  useSaveWidgetConfig,
  useCollapseNote,
  useCloseWidgetFocus,
  useSetExclusiveNoteFlag,
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
  const setNoteFlag = useSetExclusiveNoteFlag();
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

  /**
   * 폰 홈 화면 '노트' 위젯이 볼 노트로 이 노트를 지정/해제.
   *
   * 속성(스타일 편집)에도 같은 토글이 있지만, 노트는 ⋮ '편집'이 이 화면을 열기
   * 때문에 **실제로 편집하는 자리**에도 둔다 — 지정 스위치가 '스타일 편집' 뒤에만
   * 있으면 찾기 어렵다. 둘 다 같은 배타 지정을 호출하므로 항상 일치하고,
   * 켜는 순간 다른 노트의 지정은 풀린다(폰과 연결되는 노트는 하나).
   */
  const mobileOn = Boolean(config.mobileSync);
  const toggleMobile = () => setNoteFlag(instanceId, "mobileSync", !mobileOn);

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
        {/* 폰 연결 지정 — 켜면 이 노트의 소제목이 휴대폰 홈 화면 목록이 된다. */}
        <button
          type="button"
          onClick={toggleMobile}
          aria-pressed={mobileOn}
          title={
            mobileOn
              ? "휴대폰 홈 화면 ‘노트’ 위젯이 이 노트를 보고 있습니다. 누르면 연결을 해제합니다."
              : "이 노트를 휴대폰 홈 화면 ‘노트’ 위젯에 연결합니다 — 소제목이 그쪽 목록이 됩니다."
          }
          className={[
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            mobileOn
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
          ].join(" ")}
        >
          <Smartphone size={14} aria-hidden />
          {mobileOn ? "폰에 연결됨" : "폰에 연결"}
        </button>
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
