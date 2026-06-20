"use client";

/**
 * calculator · CompactView — result display + basic numpad (설계서 §2.1 #8).
 *
 *  Tile-sized: readout + a 4-column basic pad (digits, + − × ÷, =, AC, ⌫, .).
 *  State is isolated per instanceId via useCalculator. Scientific functions live
 *  in the ExpandedView (자세히).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useCalculator } from "./useCalculator";
import { KeypadButton, Readout, type CalcKey } from "./Keypad";
import type { CalculatorConfig } from "./types";

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

  return (
    <div className="flex h-full flex-col gap-2">
      <Readout
        expr={calc.expr}
        result={calc.result}
        error={calc.error}
        size={size}
      />
      <div className="grid flex-1 grid-cols-4 gap-1.5">
        {BASIC_KEYS.map((k, i) => (
          <KeypadButton
            key={`${k.label}-${i}`}
            k={k}
            size={size}
            onToken={calc.input}
            onAction={(a) =>
              a === "equals"
                ? calc.equals()
                : a === "clear"
                  ? calc.clear()
                  : a === "back"
                    ? calc.backspace()
                    : calc.negate()
            }
          />
        ))}
      </div>
    </div>
  );
}

export default CalculatorCompactView;
