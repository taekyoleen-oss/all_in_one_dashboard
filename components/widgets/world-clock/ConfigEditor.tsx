"use client";

/**
 * world-clock · ConfigEditor — manage zones + display options (설계서 §2.2).
 *
 *  Add/remove/reorder zones (ZoneManager) plus 24h/12h and seconds toggles. All
 *  changes report up via onChange (parent owns persistence).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { ZoneManager } from "./ZoneManager";
import type { WorldClockConfig } from "./types";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block size-4 rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export function WorldClockConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<WorldClockConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <ZoneManager config={config} onChange={onChange} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted-foreground">표시 옵션</legend>
        <Toggle
          label="12시간제 (오전/오후)"
          checked={config.hour12}
          onChange={(v) => onChange({ ...config, hour12: v })}
        />
        <Toggle
          label="초 표시"
          checked={config.showSeconds}
          onChange={(v) => onChange({ ...config, showSeconds: v })}
        />
      </fieldset>
    </div>
  );
}

export default WorldClockConfigEditor;
