"use client";

/**
 * translate · CompactView — 번역기 on a tile.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { TranslatePanel } from "./TranslatePanel";
import type { TranslateConfig } from "./types";

export function TranslateCompactView({
  config,
  instanceId,
}: CompactViewProps<TranslateConfig>) {
  return <TranslatePanel config={config} instanceId={instanceId} size="compact" />;
}

export default TranslateCompactView;
