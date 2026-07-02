"use client";

/**
 * note · ExpandedView — full editor (전체 편집).
 *
 *  An editable title (persisted on change) above the NoteEditor (toolbar + body +
 *  attachments). This is the primary writing surface for lecture notes.
 */

import * as React from "react";
import { PanelTopClose } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import {
  useSaveWidgetConfig,
  useCollapseNote,
  useCloseWidgetFocus,
} from "@/lib/widgets/persistence";
import { NoteEditor } from "./NoteEditor";
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
        <NoteEditor config={config} instanceId={instanceId} />
      </div>
    </div>
  );
}

export default NoteExpandedView;
