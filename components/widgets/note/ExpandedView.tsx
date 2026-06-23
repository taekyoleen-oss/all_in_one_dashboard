"use client";

/**
 * note · ExpandedView — full editor (전체 편집).
 *
 *  An editable title (persisted on change) above the NoteEditor (toolbar + body +
 *  attachments). This is the primary writing surface for lecture notes.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { NoteEditor } from "./NoteEditor";
import type { NoteConfig } from "./types";

export function NoteExpandedView({ config, instanceId }: ExpandedViewProps<NoteConfig>) {
  const save = useSaveWidgetConfig();
  const configRef = React.useRef(config);
  configRef.current = config;
  const timer = React.useRef<number | null>(null);

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
      <input
        defaultValue={config.title}
        onChange={(e) => saveTitle(e.target.value, true)}
        onBlur={(e) => saveTitle(e.target.value, false)}
        placeholder="노트 제목 (예: 6월 23일 강의)"
        data-pb-no-drag=""
        className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="min-h-0 flex-1">
        <NoteEditor config={config} instanceId={instanceId} />
      </div>
    </div>
  );
}

export default NoteExpandedView;
