"use client";

/**
 * calculator · per-instance state hook.
 *
 *  Holds the live expression + last evaluated result, keyed by instanceId so two
 *  calculators are independent. The last result is also mirrored into a
 *  module-level store keyed by instanceId, which backs the 'custom' copyBehavior
 *  (copy = the last result) for the in-widget copy button.
 *
 *  React 19: all updates run inside event handlers (button presses) — no
 *  setState-in-effect, no derived-state churn.
 */

import * as React from "react";
import { evaluateExpression } from "./evaluate";

/** Last result per instance (for copyBehavior: 'custom'). */
const lastResultStore = new Map<string, string>();

export function getLastResult(instanceId: string): string | null {
  return lastResultStore.get(instanceId) ?? null;
}

export interface CalculatorState {
  /** The expression being typed (display tokens: × ÷ √ ln log π e …). */
  expr: string;
  /** The last evaluated result, or null before the first "=". */
  result: string | null;
  /** True when the last evaluation failed (show "Error"). */
  error: boolean;
}

export interface CalculatorApi extends CalculatorState {
  /** Append a token (digit, operator, function head like "√(" or "ln("). */
  input: (token: string) => void;
  /** Backspace one display character. */
  backspace: () => void;
  /** Clear everything (AC). */
  clear: () => void;
  /** Toggle the sign of the current expression ( +/- ). */
  negate: () => void;
  /** Evaluate the expression; commit result or flag error. */
  equals: () => void;
  /** Copy the last result to the clipboard (copyBehavior: 'custom'). */
  copyResult: () => void;
}

export function useCalculator(instanceId: string): CalculatorApi {
  const [state, setState] = React.useState<CalculatorState>(() => ({
    expr: "",
    result: getLastResult(instanceId),
    error: false,
  }));

  const input = React.useCallback((token: string) => {
    setState((s) => {
      // Starting fresh input right after a result replaces it (unless the token
      // is an operator, which continues from the result).
      if (s.result !== null && !s.error && s.expr === "") {
        const isOperator = /^[+\-×÷^]/.test(token);
        return {
          expr: (isOperator ? s.result : "") + token,
          result: s.result,
          error: false,
        };
      }
      if (s.error) return { expr: token, result: null, error: false };
      return { ...s, expr: s.expr + token };
    });
  }, []);

  const backspace = React.useCallback(() => {
    setState((s) => ({ ...s, expr: s.expr.slice(0, -1), error: false }));
  }, []);

  const clear = React.useCallback(() => {
    setState({ expr: "", result: null, error: false });
  }, []);

  const negate = React.useCallback(() => {
    setState((s) => {
      const base = s.expr || (s.result ?? "");
      if (!base) return s;
      // Wrap in a unary minus group; a leading "-(" toggles back off.
      const next = base.startsWith("-(") && base.endsWith(")")
        ? base.slice(2, -1)
        : `-(${base})`;
      return { ...s, expr: next, error: false };
    });
  }, []);

  const equals = React.useCallback(() => {
    setState((s) => {
      const source = s.expr || s.result || "";
      if (!source.trim()) return s;
      const out = evaluateExpression(source);
      if (out === null) {
        return { expr: s.expr, result: null, error: true };
      }
      lastResultStore.set(instanceId, out);
      return { expr: "", result: out, error: false };
    });
  }, [instanceId]);

  const copyResult = React.useCallback(() => {
    const value = state.result ?? getLastResult(instanceId);
    if (value == null) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value).catch(() => {});
    }
  }, [state.result, instanceId]);

  return { ...state, input, backspace, clear, negate, equals, copyResult };
}
