"use client";

/**
 * essential-info · ExpandedView — 메모장(비번설정) full view. Same lock/edit
 * behavior as compact, rendered larger. Delegates to LockedMemo.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { LockedMemo } from "./LockedMemo";
import type { EssentialInfoConfig } from "./types";

export function EssentialInfoExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<EssentialInfoConfig>) {
  return (
    <div className="mx-auto h-full w-full max-w-2xl">
      <LockedMemo config={config} instanceId={instanceId} size="expanded" />
    </div>
  );
}

export default EssentialInfoExpandedView;
