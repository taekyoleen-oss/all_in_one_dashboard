"use client";

/**
 * unit-converter · CompactView — the converter on a tile (단위/환산 변환).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { ConverterPanel } from "./ConverterPanel";
import type { UnitConverterConfig } from "./types";

export function UnitConverterCompactView({
  config,
  instanceId,
}: CompactViewProps<UnitConverterConfig>) {
  return <ConverterPanel config={config} instanceId={instanceId} size="compact" />;
}

export default UnitConverterCompactView;
