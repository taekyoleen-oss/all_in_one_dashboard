"use client";

/**
 * calculator · ExpandedView — full scientific pad (설계서 §2.1 #8 + "계산기 범위").
 *
 *  사칙연산 + log ln √ x^y x² eˣ π e 괄호 +/− 소수점 clear. Plus a copy button
 *  for the last result (copyBehavior: 'custom'). Out-of-scope expressions show
 *  "Error" (the restricted evaluator throws). State isolated per instanceId.
 */

import * as React from "react";
import { Copy } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useCalculator } from "./useCalculator";
import { KeypadButton, Readout, type CalcKey } from "./Keypad";
import type { CalculatorConfig } from "./types";

// Scientific row (function heads insert "name(" so the user types the argument).
const SCI_KEYS: CalcKey[] = [
  { label: "√", token: "√(", kind: "fn", aria: "제곱근" },
  { label: "x²", token: "^2", kind: "fn", aria: "제곱" },
  { label: "xʸ", token: "^", kind: "fn", aria: "거듭제곱" },
  { label: "eˣ", token: "exp(", kind: "fn", aria: "e의 x승" },
  { label: "ln", token: "ln(", kind: "fn" },
  { label: "log", token: "log(", kind: "fn" },

  { label: "π", kind: "fn", aria: "파이" },
  { label: "e", kind: "fn" },
  { label: "(", kind: "fn" },
  { label: ")", kind: "fn" },
  { label: "+/−", action: "negate", kind: "fn", aria: "부호 바꾸기" },
  { label: "⌫", action: "back", kind: "fn", aria: "지우기" },
];

const NUM_KEYS: CalcKey[] = [
  { label: "AC", action: "clear", kind: "danger" },
  { label: "7", kind: "num" },
  { label: "8", kind: "num" },
  { label: "9", kind: "num" },
  { label: "÷", kind: "op", aria: "나누기" },

  { label: "4", kind: "num" },
  { label: "5", kind: "num" },
  { label: "6", kind: "num" },
  { label: "×", kind: "op", aria: "곱하기" },
  { label: "−", token: "-", kind: "op", aria: "빼기" },

  { label: "1", kind: "num" },
  { label: "2", kind: "num" },
  { label: "3", kind: "num" },
  { label: "+", kind: "op", aria: "더하기" },
  { label: "=", action: "equals", kind: "equals" },

  { label: "0", kind: "num", span: 2 },
  { label: ".", kind: "num" },
];

export function CalculatorExpandedView({
  instanceId,
}: ExpandedViewProps<CalculatorConfig>) {
  const calc = useCalculator(instanceId);
  const onAction = (a: NonNullable<CalcKey["action"]>) =>
    a === "equals"
      ? calc.equals()
      : a === "clear"
        ? calc.clear()
        : a === "back"
          ? calc.backspace()
          : calc.negate();

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Readout
            expr={calc.expr}
            result={calc.result}
            error={calc.error}
            size="md"
          />
        </div>
        <button
          type="button"
          onClick={calc.copyResult}
          disabled={calc.result === null}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Copy size={15} aria-hidden />
          결과 복사
        </button>
      </div>

      {/* Scientific functions */}
      <div className="grid grid-cols-6 gap-1.5">
        {SCI_KEYS.map((k, i) => (
          <KeypadButton
            key={`sci-${k.label}-${i}`}
            k={k}
            size="sm"
            onToken={calc.input}
            onAction={onAction}
          />
        ))}
      </div>

      {/* Number + operator pad */}
      <div className="grid flex-1 grid-cols-5 gap-1.5">
        {NUM_KEYS.map((k, i) => (
          <KeypadButton
            key={`num-${k.label}-${i}`}
            k={k}
            size="md"
            onToken={calc.input}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

export default CalculatorExpandedView;
