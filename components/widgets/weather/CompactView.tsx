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
import type { Weather } from "@/output/api-shapes";
import { useWeather } from "./useWeather";
import {
  ConditionIcon,
  conditionLabel,
  formatTemp,
  formatPop,
  formatHour,
  formatDay,
} from "./format";
import type { WeatherConfig } from "./types";

export function WeatherCompactView({ config }: CompactViewProps<WeatherConfig>) {
  const { data, loading, error } = useWeather(config);
  const view = config.view ?? "current";

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">날씨 불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">날씨를 불러오지 못했습니다.</p>
    );
  }

  const { current, hourly, daily, location } = data;

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="shrink-0 truncate text-xs text-muted-foreground">
        {location.label}
      </p>

      {view === "hourly" ? (
        <HourlyBody hourly={hourly} />
      ) : view === "daily" ? (
        <DailyBody daily={daily} />
      ) : (
        <CurrentBody current={current} />
      )}

      {data.stale ? (
        <p className="shrink-0 text-right text-[10px] text-muted-foreground">
          예보 기반
        </p>
      ) : null}
    </div>
  );
}

/** 현재 날씨 — big temp + condition icon. */
function CurrentBody({ current }: { current: Weather["current"] }) {
  const pop = formatPop(current.pop);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-foreground @[200px]/widget:text-4xl">
          {formatTemp(current.temp)}
        </span>
        <span className="mt-1 truncate text-sm text-foreground">
          {conditionLabel(current.condition)}
        </span>
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
  );
}

/** 시간별 — horizontal scrolling strip of the next hours. */
function HourlyBody({ hourly }: { hourly: Weather["hourly"] }) {
  if (hourly.length === 0) {
    return (
      <p className="flex-1 text-sm text-muted-foreground">시간별 예보 없음</p>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 items-center gap-1.5 overflow-x-auto pb-scroll">
      {hourly.slice(0, 12).map((h) => {
        const pop = formatPop(h.pop);
        return (
          <li
            key={h.ts}
            className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border border-border bg-background/40 px-2 py-1.5"
          >
            <span className="text-[10px] text-muted-foreground">
              {formatHour(h.ts)}
            </span>
            <ConditionIcon
              condition={h.condition}
              size={18}
              aria-label={conditionLabel(h.condition)}
              className="text-foreground"
            />
            <span className="font-mono text-xs tabular-nums text-foreground">
              {formatTemp(h.temp)}
            </span>
            <span className="h-2.5 text-[9px] text-muted-foreground">
              {pop ?? ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 주간 — daily min/max list. */
function DailyBody({ daily }: { daily: Weather["daily"] }) {
  if (daily.length === 0) {
    return <p className="flex-1 text-sm text-muted-foreground">주간 예보 없음</p>;
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-scroll">
      {daily.map((d) => (
        <li key={d.date} className="flex items-center gap-2 px-0.5 py-0.5">
          <span className="w-8 shrink-0 text-xs text-foreground">
            {formatDay(d.date)}
          </span>
          <ConditionIcon
            condition={d.condition}
            size={15}
            aria-label={conditionLabel(d.condition)}
            className="shrink-0 text-foreground"
          />
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatTemp(d.tempMin)}
          </span>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
            {formatTemp(d.tempMax)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default WeatherCompactView;
