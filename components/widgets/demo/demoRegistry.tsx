"use client";

/**
 * DEMO widget registry — proves the Phase 2-A architecture only.
 *
 *  NOT the real 15 widgets (those are Phase 4, by widget-engineer). These two
 *  placeholders exercise the contract + canvas:
 *    • memo  — editable LOCAL text (each instance keeps its own state ⇒ proves
 *              instance isolation).
 *    • clock — live current time (proves a self-updating CompactView).
 *
 *  They implement the frozen `WidgetDefinition` surface from
 *  `@/lib/widgets/contract`, so they validate the contract end-to-end.
 */

import * as React from "react";
import { NotebookPen, Clock } from "lucide-react";
import type {
  WidgetDefinition,
  WidgetRegistry,
  CompactViewProps,
  ExpandedViewProps,
  ConfigEditorProps,
} from "@/lib/widgets/contract";

/* --------------------------------- memo ----------------------------------- */

interface MemoConfig {
  text: string;
}

function MemoCompact({ config }: CompactViewProps<MemoConfig>) {
  // Local state seeded from config → demonstrates per-instance independence.
  const [text, setText] = React.useState(config.text);
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      spellCheck={false}
      className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground @[220px]/widget:text-base"
      placeholder="메모를 입력하세요…"
    />
  );
}

function MemoExpanded({ config }: ExpandedViewProps<MemoConfig>) {
  return (
    <div className="text-base leading-relaxed text-foreground">{config.text}</div>
  );
}

function MemoConfigEditor({ config, onChange }: ConfigEditorProps<MemoConfig>) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-muted-foreground">메모 내용</span>
      <textarea
        value={config.text}
        onChange={(e) => onChange({ ...config, text: e.target.value })}
        className="min-h-24 rounded-md border border-border bg-background p-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

const memo: WidgetDefinition<MemoConfig> = {
  type: "memo",
  displayName: "메모",
  icon: NotebookPen,
  category: "core",
  defaultConfig: { text: "" },
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 8, h: 6 },
  CompactView: MemoCompact,
  ExpandedView: MemoExpanded,
  ConfigEditor: MemoConfigEditor,
  copyBehavior: "content",
  dataMode: "static",
};

/* --------------------------------- clock ---------------------------------- */

interface ClockConfig {
  label: string;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ClockCompact({ config, density }: CompactViewProps<ClockConfig>) {
  const now = useNow();
  const time = now.toLocaleTimeString("ko-KR", { hour12: false });
  const date = now.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <span className="text-xs text-muted-foreground">{config.label}</span>
      <span
        // Live clock: server/client times differ by design — suppress the
        // hydration text-mismatch warning for this timestamp node.
        suppressHydrationWarning
        className={
          density === "compact"
            ? "font-mono text-xl tabular-nums"
            : "font-mono text-3xl tabular-nums @[300px]/widget:text-4xl"
        }
      >
        {time}
      </span>
      <span suppressHydrationWarning className="text-xs text-muted-foreground">
        {date}
      </span>
    </div>
  );
}

function ClockExpanded({ config }: ExpandedViewProps<ClockConfig>) {
  const now = useNow();
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">{config.label}</span>
      <span suppressHydrationWarning className="font-mono text-5xl tabular-nums">
        {now.toLocaleTimeString("ko-KR", { hour12: false })}
      </span>
    </div>
  );
}

function ClockConfigEditor({ config, onChange }: ConfigEditorProps<ClockConfig>) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-muted-foreground">라벨</span>
      <input
        value={config.label}
        onChange={(e) => onChange({ ...config, label: e.target.value })}
        className="rounded-md border border-border bg-background p-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

const clock: WidgetDefinition<ClockConfig> = {
  type: "clock",
  displayName: "시계",
  icon: Clock,
  category: "core",
  defaultConfig: { label: "현재 시각" },
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 4 },
  CompactView: ClockCompact,
  ExpandedView: ClockExpanded,
  ConfigEditor: ClockConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

/* ------------------------------- the registry ----------------------------- */

export const demoRegistry: WidgetRegistry = {
  [memo.type]: memo as WidgetDefinition,
  [clock.type]: clock as WidgetDefinition,
};
