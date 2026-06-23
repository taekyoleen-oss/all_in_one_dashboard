"use client";

/**
 * timer · ExpandedView — the same panel, larger (타이머/스톱워치/뽀모도로).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { TimerPanel } from "./TimerPanel";
import type { TimerConfig } from "./types";

export function TimerExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<TimerConfig>) {
  return (
    <div className="mx-auto flex min-h-[360px] max-w-sm flex-col">
      <TimerPanel config={config} instanceId={instanceId} size="expanded" />
    </div>
  );
}

export default TimerExpandedView;
