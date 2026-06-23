"use client";

/**
 * sun-moon · CompactView — today's sunrise/sunset + moon phase (일출·일몰/달).
 *
 *  All computed locally from the device clock (astro.ts). Shows 일출/일몰 times,
 *  day length, the next sun event countdown, and the moon phase (emoji + name +
 *  illumination %). useNow keeps the countdown live.
 */

import * as React from "react";
import { Sunrise, Sunset } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { computeSunTimes, computeMoon } from "./astro";
import type { SunMoonConfig } from "./types";

function hhmm(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function nextEvent(
  now: Date,
  sunrise: Date | null,
  sunset: Date | null,
): { label: string; at: Date } | null {
  const candidates: Array<{ label: string; at: Date }> = [];
  if (sunrise && sunrise > now) candidates.push({ label: "일출까지", at: sunrise });
  if (sunset && sunset > now) candidates.push({ label: "일몰까지", at: sunset });
  candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
  return candidates[0] ?? null;
}

function untilText(now: Date, at: Date): string {
  const mins = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function SunMoonCompactView({ config }: CompactViewProps<SunMoonConfig>) {
  const now = useNow(60_000);
  const sun = computeSunTimes(now, config.lat, config.lon);
  const moon = computeMoon(now);
  const next = nextEvent(now, sun.sunrise, sun.sunset);
  const dayH = Math.floor(sun.dayLengthMin / 60);
  const dayM = Math.round(sun.dayLengthMin % 60);

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3">
      <div className="flex items-center justify-around gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <Sunrise size={20} className="text-amber-500" aria-hidden />
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground @[220px]/widget:text-xl">
            {hhmm(sun.sunrise)}
          </span>
          <span className="text-[10px] text-muted-foreground">일출</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Sunset size={20} className="text-orange-500" aria-hidden />
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground @[220px]/widget:text-xl">
            {hhmm(sun.sunset)}
          </span>
          <span className="text-[10px] text-muted-foreground">일몰</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-2xl leading-none @[220px]/widget:text-3xl" aria-hidden>
            {moon.emoji}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {Math.round(moon.illumination * 100)}%
          </span>
          <span className="max-w-[5rem] truncate text-[10px] text-muted-foreground">
            {moon.name}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
        <span>
          {sun.polar === "day"
            ? "백야"
            : sun.polar === "night"
              ? "극야"
              : `낮 길이 ${dayH}시간 ${dayM}분`}
        </span>
        {next ? (
          <span className="text-foreground">
            {next.label} {untilText(now, next.at)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default SunMoonCompactView;
