"use client";

/**
 * unit-converter · ConverterPanel — the shared converter UI (단위/환산 변환).
 *
 *  Used by both CompactView and ExpandedView (sizes differ via `size`). Holds the
 *  input value in local state for snappy typing and persists the whole config
 *  (category/from/to/value) via useSaveWidgetConfig — the canvas debounces the
 *  write. Category change resets from/to to that category's defaults. A swap
 *  button flips from↔to.
 */

import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  CATEGORIES,
  findCategory,
  convert,
  formatResult,
} from "./units";
import type { UnitConverterConfig } from "./types";

const selectCls =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ConverterPanel({
  config,
  instanceId,
  size = "compact",
}: {
  config: UnitConverterConfig;
  instanceId: string;
  size?: "compact" | "expanded";
}) {
  const save = useSaveWidgetConfig();
  const [valueInput, setValueInput] = React.useState(String(config.value ?? ""));

  // Keep the input in sync if config changes from elsewhere (e.g. duplicate).
  const lastConfigValue = React.useRef(config.value);
  React.useEffect(() => {
    if (config.value !== lastConfigValue.current) {
      lastConfigValue.current = config.value;
      setValueInput(String(config.value ?? ""));
    }
  }, [config.value]);

  const cat = findCategory(config.category);
  const numeric = Number(valueInput);
  const valid = valueInput.trim() !== "" && Number.isFinite(numeric);
  const result = valid ? convert(numeric, cat.id, config.from, config.to) : NaN;

  const persist = (next: Partial<UnitConverterConfig>) => {
    const merged = { ...config, ...next };
    lastConfigValue.current = merged.value;
    save(instanceId, merged);
  };

  const onValue = (v: string) => {
    setValueInput(v);
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n)) persist({ value: n });
  };

  const onCategory = (id: string) => {
    const c = findCategory(id);
    persist({ category: c.id, from: c.defaultFrom, to: c.defaultTo });
  };

  const swap = () => persist({ from: config.to, to: config.from });

  const big = size === "expanded";

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {/* Category selector */}
      <select
        value={cat.id}
        onChange={(e) => onCategory(e.target.value)}
        aria-label="변환 종류"
        className={selectCls}
      >
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      {/* From */}
      <div className="flex flex-col gap-1">
        <input
          value={valueInput}
          onChange={(e) => onValue(e.target.value)}
          inputMode="decimal"
          placeholder="값 입력"
          aria-label="입력 값"
          className={`w-full rounded-md border border-border bg-background px-2 ${
            big ? "py-2 text-lg" : "py-1.5 text-base"
          } font-mono tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        />
        <select
          value={config.from}
          onChange={(e) => persist({ from: e.target.value })}
          aria-label="변환 전 단위"
          className={selectCls}
        >
          {cat.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      {/* Swap */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={swap}
          aria-label="단위 바꾸기"
          title="단위 바꾸기"
          className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftRight size={16} className="rotate-90" aria-hidden />
        </button>
      </div>

      {/* To / result */}
      <div className="flex flex-col gap-1">
        <div
          className={`w-full truncate rounded-md border border-primary/40 bg-primary/5 px-2 ${
            big ? "py-2 text-xl" : "py-1.5 text-base"
          } font-mono font-semibold tabular-nums text-foreground`}
          aria-live="polite"
        >
          {valid ? formatResult(result) : "—"}
        </div>
        <select
          value={config.to}
          onChange={(e) => persist({ to: e.target.value })}
          aria-label="변환 후 단위"
          className={selectCls}
        >
          {cat.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default ConverterPanel;
