"use client";

/**
 * calculator · ConfigEditor — display density only (설계서 §2.1 #8 "설정 없음").
 *
 *  The calculator has no functional settings; this only tunes the keypad density.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { CalculatorConfig } from "./types";

const OPTIONS: { value: CalculatorConfig["display"]; label: string; hint: string }[] = [
  { value: "comfortable", label: "넉넉하게", hint: "큰 버튼·읽기 쉬운 표시" },
  { value: "compact", label: "조밀하게", hint: "작은 버튼·좁은 타일에 적합" },
];

export function CalculatorConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<CalculatorConfig>) {
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 text-muted-foreground">표시 밀도</legend>
      {OPTIONS.map((opt) => {
        const selected = config.display === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange({ ...config, display: opt.value })}
            className={[
              "flex items-center justify-between rounded-md border px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-ring bg-accent text-accent-foreground"
                : "border-border text-foreground hover:bg-accent/60",
            ].join(" ")}
          >
            <span className="font-medium">{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.hint}</span>
          </button>
        );
      })}
      <p className="mt-1 text-xs text-muted-foreground">
        계산기는 별도 설정이 없습니다. 사칙연산과 과학 함수(√, ln, log, π 등)는
        “자세히 보기”에서 사용할 수 있습니다.
      </p>
    </fieldset>
  );
}

export default CalculatorConfigEditor;
