"use client";

/**
 * weather · ExpandedView — current + hourly strip + daily forecast (설계서 §2.1).
 *
 *  Same poll subscription as compact, rendered larger: current conditions, a
 *  horizontally-scrolling hourly strip, and a daily min/max list. Each condition
 *  shows an icon AND a text label (접근성). Source/refresh line at the bottom;
 *  the location is managed in the ConfigEditor (편집), not here.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useWeather } from "./useWeather";
import {
  ConditionIcon,
  conditionLabel,
  formatTemp,
  formatHour,
  formatDay,
  formatPop,
} from "./format";
import type { WeatherConfig } from "./types";

function formatTime(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WeatherExpandedView({ config }: ExpandedViewProps<WeatherConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useWeather(config);

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
    <div className="flex flex-col gap-4">
      {/* Header: location + refresh */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{location.label}</span>
        <button
          type="button"
          onClick={refresh}
          className="shrink-0 rounded-full border border-border px-2 py-0.5 text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          새로고침
        </button>
      </div>

      {/* Current */}
      <div className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card/40 p-3">
        <ConditionIcon
          condition={current.condition}
          size={48}
          aria-hidden
          className="shrink-0 text-foreground"
        />
        <div className="flex flex-col">
          <span className="font-mono text-4xl font-semibold tabular-nums leading-none text-foreground">
            {formatTemp(current.temp)}
          </span>
          <span className="mt-1 text-sm text-foreground">
            {conditionLabel(current.condition)}
          </span>
        </div>
        <dl className="ml-auto grid grid-cols-1 gap-0.5 text-right text-xs text-muted-foreground">
          {typeof current.feelsLike === "number" ? (
            <div className="flex justify-end gap-1">
              <dt>체감</dt>
              <dd className="text-foreground">{formatTemp(current.feelsLike)}</dd>
            </div>
          ) : null}
          {typeof current.humidity === "number" ? (
            <div className="flex justify-end gap-1">
              <dt>습도</dt>
              <dd className="text-foreground">{Math.round(current.humidity)}%</dd>
            </div>
          ) : null}
          {typeof current.windSpeed === "number" ? (
            <div className="flex justify-end gap-1">
              <dt>바람</dt>
              <dd className="text-foreground">
                {current.windSpeed.toFixed(1)} m/s
              </dd>
            </div>
          ) : null}
          {formatPop(current.pop) ? (
            <div className="flex justify-end gap-1">
              <dt>강수확률</dt>
              <dd className="text-foreground">{formatPop(current.pop)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {/* Hourly strip */}
      {hourly.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">시간별</h3>
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {hourly.slice(0, 12).map((h) => {
              const pop = formatPop(h.pop);
              return (
                <li
                  key={h.ts}
                  className="flex shrink-0 flex-col items-center gap-1 rounded-md border border-border bg-background/40 px-2.5 py-2"
                >
                  <span className="text-[11px] text-muted-foreground">
                    {formatHour(h.ts)}
                  </span>
                  <ConditionIcon
                    condition={h.condition}
                    size={20}
                    aria-label={conditionLabel(h.condition)}
                    className="text-foreground"
                  />
                  <span className="font-mono text-sm tabular-nums text-foreground">
                    {formatTemp(h.temp)}
                  </span>
                  <span className="h-3 text-[10px] text-muted-foreground">
                    {pop ?? ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Daily list */}
      {daily.length > 0 ? (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-medium text-muted-foreground">주간</h3>
          <ul className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/40 p-2">
            {daily.map((d) => {
              return (
                <li
                  key={d.date}
                  className="flex items-center gap-3 rounded-md px-1.5 py-1"
                >
                  <span className="w-10 shrink-0 text-sm text-foreground">
                    {formatDay(d.date)}
                  </span>
                  <ConditionIcon
                    condition={d.condition}
                    size={18}
                    aria-label={conditionLabel(d.condition)}
                    className="shrink-0 text-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {conditionLabel(d.condition)}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                    {formatTemp(d.tempMin)}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatTemp(d.tempMax)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Source / updated line */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data.provider === "kma"
            ? "기상청(KMA) 단기예보"
            : "Open-Meteo 예보(근사치)"}
        </span>
        <span>갱신: {formatTime(lastUpdated)}</span>
      </div>
    </div>
  );
}

export default WeatherExpandedView;
