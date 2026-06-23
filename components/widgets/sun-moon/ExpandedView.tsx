"use client";

/**
 * sun-moon · ExpandedView — full sun + moon detail (일출·일몰/달 위상).
 *
 *  Sunrise/sunset/solar-noon/day-length cards, plus a moon panel with phase,
 *  illumination, age, and days to the next full/new moon. All local computation.
 */

import * as React from "react";
import { Sunrise, Sunset, Sun } from "lucide-react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { computeSunTimes, computeMoon, nextMoonEvents } from "./astro";
import type { SunMoonConfig } from "./types";

function hhmm(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/60 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {sub ? <span className="text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

export function SunMoonExpandedView({ config }: ExpandedViewProps<SunMoonConfig>) {
  const now = useNow(60_000);
  const sun = computeSunTimes(now, config.lat, config.lon);
  const moon = computeMoon(now);
  const events = nextMoonEvents(now);
  const dayH = Math.floor(sun.dayLengthMin / 60);
  const dayM = Math.round(sun.dayLengthMin % 60);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-muted-foreground">{config.label}</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          icon={<Sunrise size={13} className="text-amber-500" aria-hidden />}
          label="일출"
          value={hhmm(sun.sunrise)}
        />
        <Card
          icon={<Sunset size={13} className="text-orange-500" aria-hidden />}
          label="일몰"
          value={hhmm(sun.sunset)}
        />
        <Card
          icon={<Sun size={13} className="text-yellow-500" aria-hidden />}
          label="남중 (정오)"
          value={hhmm(sun.solarNoon)}
        />
        <Card
          icon={<Sun size={13} className="text-muted-foreground" aria-hidden />}
          label="낮 길이"
          value={
            sun.polar === "day" ? "백야" : sun.polar === "night" ? "극야" : `${dayH}:${String(dayM).padStart(2, "0")}`
          }
          sub={sun.polar ? undefined : "시간:분"}
        />
      </div>

      <div className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card/60 p-4">
        <span className="text-5xl" aria-hidden>
          {moon.emoji}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-lg font-semibold text-foreground">{moon.name}</span>
          <span className="text-sm text-muted-foreground">
            밝기 {Math.round(moon.illumination * 100)}% · 월령 {moon.ageDays.toFixed(1)}일
          </span>
          <span className="text-xs text-muted-foreground">
            보름달까지 {Math.round(events.toFull)}일 · 다음 삭까지 {Math.round(events.toNew)}일
          </span>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        일출·일몰은 NOAA 근사식, 달 위상은 삭망월(29.53일) 기준 로컬 계산값입니다(분 단위 오차 가능).
      </p>
    </div>
  );
}

export default SunMoonExpandedView;
