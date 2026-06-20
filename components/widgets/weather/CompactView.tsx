"use client";

/**
 * weather · CompactView — current conditions on the canvas tile (설계서 §2.1).
 *
 *  Polls /api/weather via useWeather (keyless Open-Meteo fallback works today).
 *  Shows the location, a big current temp, and the condition as an icon AND a
 *  text label (never icon/color-only — 접근성). Reflows by @container width; the
 *  location comes from this instance's config (격리).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useWeather } from "./useWeather";
import { ConditionIcon, conditionLabel, formatTemp, formatPop } from "./format";
import type { WeatherConfig } from "./types";

export function WeatherCompactView({ config }: CompactViewProps<WeatherConfig>) {
  const { data, loading, error } = useWeather(config);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">날씨 불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">날씨를 불러오지 못했습니다.</p>
    );
  }

  const { current, location } = data;
  const label = conditionLabel(current.condition);
  const pop = formatPop(current.pop);

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="truncate text-xs text-muted-foreground">{location.label}</p>

      <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-foreground @[200px]/widget:text-4xl">
            {formatTemp(current.temp)}
          </span>
          <span className="mt-1 truncate text-sm text-foreground">{label}</span>
          {typeof current.feelsLike === "number" ? (
            <span className="truncate text-[11px] text-muted-foreground">
              체감 {formatTemp(current.feelsLike)}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 text-muted-foreground">
          <ConditionIcon
            condition={current.condition}
            size={40}
            aria-hidden
            className="text-foreground"
          />
          {pop ? <span className="text-[11px]">강수 {pop}</span> : null}
        </div>
      </div>

      {data.stale ? (
        <p className="shrink-0 text-right text-[10px] text-muted-foreground">
          예보 기반
        </p>
      ) : null}
    </div>
  );
}

export default WeatherCompactView;
