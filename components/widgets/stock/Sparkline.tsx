"use client";

/**
 * stock · Sparkline — a tiny inline trend chart (설계서 §2.1 expanded view).
 *
 *  Pure SVG, no dependency. Draws the rolling price history as a polyline,
 *  colored by overall direction (token-driven). Decorative: the numeric value +
 *  arrow carry the real signal, so the sparkline is aria-hidden.
 */

import * as React from "react";
import type { Direction } from "./format";

export function Sparkline({
  points,
  direction,
  width = 72,
  height = 24,
  className,
}: {
  points: number[];
  direction: Direction;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) {
    // Not enough history yet — render an empty box of the same size to avoid jump.
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden
        role="presentation"
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const d = points
    .map((p, i) => {
      const x = i * stepX;
      // Invert y (SVG origin top-left); pad 2px top/bottom.
      const y = height - 2 - ((p - min) / span) * (height - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke =
    direction === "up"
      ? "var(--positive)"
      : direction === "down"
        ? "var(--negative)"
        : "var(--muted-foreground)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      role="presentation"
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Sparkline;
