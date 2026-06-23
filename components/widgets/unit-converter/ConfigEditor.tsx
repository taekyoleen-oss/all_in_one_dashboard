"use client";

/**
 * unit-converter · ConfigEditor — pick the default category + units (단위/환산).
 *
 *  Conversion itself happens right on the tile; this dialog just sets the starting
 *  category and units. Reports the whole next config via onChange (parent persists).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { CATEGORIES, findCategory } from "./units";
import type { UnitConverterConfig } from "./types";

const selectCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function UnitConverterConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<UnitConverterConfig>) {
  const cat = findCategory(config.category);

  const onCategory = (id: string) => {
    const c = findCategory(id);
    onChange({ ...config, category: c.id, from: c.defaultFrom, to: c.defaultTo });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        기본 변환 종류
        <select
          value={cat.id}
          onChange={(e) => onCategory(e.target.value)}
          className={selectCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          변환 전 단위
          <select
            value={config.from}
            onChange={(e) => onChange({ ...config, from: e.target.value })}
            className={selectCls}
          >
            {cat.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          변환 후 단위
          <select
            value={config.to}
            onChange={(e) => onChange({ ...config, to: e.target.value })}
            className={selectCls}
          >
            {cat.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[11px] text-muted-foreground">
        값 입력과 단위 변경은 위젯 타일에서 바로 할 수 있어요. 길이·무게·온도·넓이·부피·속도·시간·데이터를 지원하며 평·근·돈·되 등 한국 단위도 포함합니다.
      </p>
    </div>
  );
}

export default UnitConverterConfigEditor;
