"use client";

/**
 * timer · CompactView — 타이머/스톱워치/뽀모도로 on a tile.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { TimerPanel } from "./TimerPanel";
import type { TimerConfig } from "./types";

export function TimerCompactView({
  config,
  instanceId,
}: CompactViewProps<TimerConfig>) {
  return <TimerPanel config={config} instanceId={instanceId} size="compact" />;
}

export default TimerCompactView;
