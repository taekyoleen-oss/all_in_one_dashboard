"use client";

/**
 * translate · ConfigEditor — default source/target languages (번역기).
 *
 *  Translating itself happens on the tile; this dialog just sets the default
 *  language pair. Reports the whole next config via onChange (parent persists).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { LANGS, SOURCE_LANGS } from "./langs";
import type { TranslateConfig } from "./types";

const selectCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TranslateConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<TranslateConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          원본 언어
          <select
            value={config.source}
            onChange={(e) => onChange({ ...config, source: e.target.value })}
            className={selectCls}
          >
            {SOURCE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          번역 언어
          <select
            value={config.target}
            onChange={(e) => onChange({ ...config, target: e.target.value })}
            className={selectCls}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        키 없이 바로 동작합니다(무료 번역 엔진). DEEPL_API_KEY를 설정하면 DeepL로 자동 전환됩니다.
        입력과 번역은 위젯 타일에서 바로 할 수 있어요(Ctrl/⌘+Enter로 번역).
      </p>
    </div>
  );
}

export default TranslateConfigEditor;
