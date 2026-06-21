"use client";

/**
 * calculator · CompactView — result display + basic numpad (설계서 §2.1 #8).
 *
 *  Tile-sized: readout + a compact scientific row (√ x² xʸ eˣ ln log π e) over a
 *  4-column basic pad (digits, + − × ÷, =, AC, ⌫, .). The scientific keys let
 *  root/log/exponent calculate right on the tile; the ExpandedView (자세히) has
 *  the same set with bigger keys. State is isolated per instanceId.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useCalculator } from "./useCalculator";
import { KeypadButton, Readout, type CalcKey } from "./Keypad";
import type { CalculatorConfig } from "./types";

// Scientific keys (function heads insert "name(" so the user types the argument).
// 루트(√)·지수(x² xʸ eˣ)·로그(ln log) + 상수(π e) — all evaluated by evaluate.ts.
const SCI_KEYS: CalcKey[] = [
  { label: "√", token: "√(", kind: "fn", aria: "제곱근" },
  { label: "x²", token: "^2", kind: "fn", aria: "제곱" },
  { label: "xʸ", token: "^", kind: "fn", aria: "거듭제곱" },
  { label: "eˣ", token: "exp(", kind: "fn", aria: "e의 x승" },

  { label: "ln", token: "ln(", kind: "fn" },
  { label: "log", token: "log(", kind: "fn" },
  { label: "π", kind: "fn", aria: "파이" },
  { label: "e", kind: "fn" },
];

const BASIC_KEYS: CalcKey[] = [
  { label: "AC", action: "clear", kind: "danger" },
  { label: "⌫", action: "back", kind: "fn", aria: "지우기" },
  { label: "(", kind: "fn" },
  { label: ")", kind: "fn" },

  { label: "7", kind: "num" },
  { label: "8", kind: "num" },
  { label: "9", kind: "num" },
  { label: "÷", kind: "op", aria: "나누기" },

  { label: "4", kind: "num" },
  { label: "5", kind: "num" },
  { label: "6", kind: "num" },
  { label: "×", kind: "op", aria: "곱하기" },

  { label: "1", kind: "num" },
  { label: "2", kind: "num" },
  { label: "3", kind: "num" },
  { label: "−", token: "-", kind: "op", aria: "빼기" },

  { label: "0", kind: "num" },
  { label: ".", kind: "num" },
  { label: "=", action: "equals", kind: "equals" },
  { label: "+", kind: "op", aria: "더하기" },
];

export function CalculatorCompactView({
  config,
  instanceId,
}: CompactViewProps<CalculatorConfig>) {
  const calc = useCalculator(instanceId);
  const size = config.display === "compact" ? "sm" : "md";
  const onAction = (a: NonNullable<CalcKey["action"]>) =>
    a === "equals"
      ? calc.equals()
      : a === "clear"
        ? calc.clear()
        : a === "back"
          ? calc.backspace()
          : calc.negate();

  return (
    <div className="flex h-full flex-col gap-2">
      <Readout
        expr={calc.expr}
        result={calc.result}
        error={calc.error}
        size={size}
      />
      {/* Scientific row — root / exponent / log / constants. Always "sm" so the
          extra keys stay compact on the tile. */}
      <div className="grid grid-cols-4 gap-1.5">
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
      <div className="grid flex-1 grid-cols-4 gap-1.5">
        {BASIC_KEYS.map((k, i) => (
          <KeypadButton
            key={`${k.label}-${i}`}
            k={k}
            size={size}
            onToken={calc.input}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}

export default CalculatorCompactView;
