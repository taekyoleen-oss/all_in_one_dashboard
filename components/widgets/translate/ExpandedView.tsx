"use client";

/**
 * translate · ExpandedView — 번역기, roomier (larger input + result).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { TranslatePanel } from "./TranslatePanel";
import type { TranslateConfig } from "./types";

export function TranslateExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<TranslateConfig>) {
  return (
    <div className="mx-auto max-w-lg">
      <TranslatePanel config={config} instanceId={instanceId} size="expanded" />
    </div>
  );
}

export default TranslateExpandedView;
