"use client";

/**
 * essential-info · CompactView — 메모장(비번설정): a freeform note that locks
 * behind a password and auto-relocks after inactivity. Delegates to LockedMemo.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { LockedMemo } from "./LockedMemo";
import type { EssentialInfoConfig } from "./types";

export function EssentialInfoCompactView({
  config,
  instanceId,
}: CompactViewProps<EssentialInfoConfig>) {
  return (
    <div className="h-full w-full">
      <LockedMemo config={config} instanceId={instanceId} size="compact" />
    </div>
  );
}

export default EssentialInfoCompactView;
