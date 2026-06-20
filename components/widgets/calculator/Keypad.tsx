"use client";

/**
 * calculator · shared keypad primitives (button + readout).
 *
 *  Every key is a real <button> (keyboard-operable, focus-visible ring). Colors
 *  distinguish operator/equals keys, but each key is also labeled with its glyph,
 *  so color is never the only signal. Honors prefers-reduced-motion via the
 *  global CSS block (no JS-driven animation here).
 */

import * as React from "react";

export type KeyKind = "num" | "op" | "fn" | "equals" | "danger";

const KIND_SKIN: Record<KeyKind, string> = {
  num: "bg-muted/40 text-foreground hover:bg-muted",
  op: "bg-accent text-accent-foreground hover:bg-accent/80",
  fn: "bg-muted/20 text-muted-foreground hover:bg-muted/50",
  equals: "bg-primary text-primary-foreground hover:opacity-90",
  danger: "bg-destructive/15 text-destructive hover:bg-destructive/25",
};

export interface CalcKey {
  /** Visible glyph. */
  label: string;
  /** Token appended to the expression (defaults to label). */
  token?: string;
  /** Action key instead of token append. */
  action?: "equals" | "clear" | "back" | "negate";
  kind: KeyKind;
  /** Grid column span. */
  span?: number;
  /** Accessible name override (for symbols like √, ×). */
  aria?: string;
}

export function KeypadButton({
  k,
  onToken,
  onAction,
  size,
}: {
  k: CalcKey;
  onToken: (token: string) => void;
  onAction: (action: NonNullable<CalcKey["action"]>) => void;
  size: "sm" | "md";
}) {
  const handle = () => {
    if (k.action) onAction(k.action);
    else onToken(k.token ?? k.label);
  };
  return (
    <button
      type="button"
      onClick={handle}
      aria-label={k.aria ?? k.label}
      style={k.span ? { gridColumn: `span ${k.span} / span ${k.span}` } : undefined}
      className={[
        "flex items-center justify-center rounded-md font-medium tabular-nums outline-none",
        "transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:active:scale-100",
        size === "sm" ? "h-9 text-sm" : "h-11 text-base",
        KIND_SKIN[k.kind],
      ].join(" ")}
    >
      {k.label}
    </button>
  );
}

export function Readout({
  expr,
  result,
  error,
  size,
}: {
  expr: string;
  result: string | null;
  error: boolean;
  size: "sm" | "md";
}) {
  const primary = error ? "Error" : result !== null && expr === "" ? result : expr || "0";
  const secondary = error ? "" : result !== null && expr !== "" ? `Ans = ${result}` : "";

  return (
    <div
      className={[
        "flex flex-col items-end justify-end overflow-hidden rounded-md border border-border bg-background/60 px-3 py-2 text-right",
        size === "sm" ? "min-h-12" : "min-h-16",
      ].join(" ")}
    >
      {secondary ? (
        <span className="max-w-full truncate text-xs text-muted-foreground">
          {secondary}
        </span>
      ) : null}
      <span
        aria-live="polite"
        className={[
          "max-w-full truncate font-mono tabular-nums",
          error ? "text-destructive" : "text-foreground",
          size === "sm" ? "text-xl" : "text-2xl @[320px]/widget:text-3xl",
        ].join(" ")}
      >
        {primary}
      </span>
    </div>
  );
}
