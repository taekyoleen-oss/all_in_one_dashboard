"use client";

/**
 * unit-converter · ExpandedView — converter + full reference table (단위/환산).
 *
 *  The panel on the left, and a table converting the current input value to every
 *  unit in the category on the right (so you see all equivalents at once).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { ConverterPanel } from "./ConverterPanel";
import { findCategory, convert, formatResult } from "./units";
import type { UnitConverterConfig } from "./types";

export function UnitConverterExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<UnitConverterConfig>) {
  const cat = findCategory(config.category);
  const value = Number.isFinite(config.value) ? config.value : 0;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="max-w-xs">
        <ConverterPanel config={config} instanceId={instanceId} size="expanded" />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {cat.label} — {formatResult(value)} {unitLabel(cat, config.from)} 기준
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-[var(--radius)] border border-border">
          {cat.units.map((u) => {
            const converted = convert(value, cat.id, config.from, u.id);
            const active = u.id === config.to;
            return (
              <li
                key={u.id}
                className={`flex items-center justify-between gap-3 px-3 py-2 ${
                  active ? "bg-primary/5" : ""
                }`}
              >
                <span className="text-sm text-foreground">{u.label}</span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {formatResult(converted)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function unitLabel(
  cat: ReturnType<typeof findCategory>,
  id: string,
): string {
  return cat.units.find((u) => u.id === id)?.label ?? id;
}

export default UnitConverterExpandedView;
