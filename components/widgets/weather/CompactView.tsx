"use client";

/**
 * weather · CompactView — current conditions on the canvas tile (설계서 §2.1).
 *
 *  Polls /api/weather via useWeather (keyless Open-Meteo fallback works today).
 *  Shows the location, a big current temp, and the condition as an icon AND a
 *  text label (never icon/color-only — 접근성). Reflows by @container width; the
 *  location comes from this instance's config (격리).
 *
 *  기온은 소숫점 1자리(formatTemp)로 표시한다. 시간별·주간 목록은 config 의
 *  hourlyLayout/dailyLayout 에 따라 가로(strip) 또는 세로(목록)로 그린다. 현재
 *  날씨에는 어제 같은 시각 대비 변화(어제 대비)를 함께 보여준다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import type { Weather } from "@/output/api-shapes";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { useWeather } from "./useWeather";
import {
  ConditionIcon,
  conditionLabel,
  formatTemp,
  formatTempDelta,
  formatPop,
  formatHour,
  formatDay,
  type TempTrend,
} from "./format";
import {
  isGenericWeatherLabel,
  type WeatherConfig,
  type WeatherLayout,
} from "./types";

/** Tailwind text-color for an 어제 대비 trend (오름=따뜻=주황, 내림=쌀쌀=파랑). */
function trendColor(trend: TempTrend): string {
  if (trend === "up") return "text-orange-500";
  if (trend === "down") return "text-sky-500";
  return "text-muted-foreground";
}

export function WeatherCompactView({ config }: CompactViewProps<WeatherConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useWeather(config);
  const view = config.view ?? "current";
  const hourlyLayout: WeatherLayout = config.hourlyLayout ?? "horizontal";
  const dailyLayout: WeatherLayout = config.dailyLayout ?? "horizontal";

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">날씨 불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">날씨를 불러오지 못했습니다.</p>
    );
  }

  const { current, hourly, daily, location } = data;
  // 대략적 라벨(도시·기본값)이면 좌표의 동(洞)으로 더 세분화해 표시(요구: 실제 동까지).
  const placeLabel = isGenericWeatherLabel(location.label)
    ? (location.dong ?? location.label)
    : location.label;

  return (
    <div className="flex h-full flex-col gap-1">
      <p className="shrink-0 truncate text-xs text-muted-foreground">
        {placeLabel}
      </p>
      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} size="compact" />

      {view === "hourly" ? (
        <HourlyBody hourly={hourly} layout={hourlyLayout} />
      ) : view === "daily" ? (
        <DailyBody daily={daily} layout={dailyLayout} />
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

/** 현재 날씨 — big temp + condition icon + 어제 대비. */
function CurrentBody({ current }: { current: Weather["current"] }) {
  const pop = formatPop(current.pop);
  const delta =
    typeof current.tempYesterday === "number"
      ? formatTempDelta(current.temp, current.tempYesterday)
      : null;
  return (
    <div className="flex min-h-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        {/* 기온을 조금 작게(text-2xl→@200px text-3xl) 해서 소숫점 1자리가 잘 보이게. */}
        <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-foreground @[200px]/widget:text-3xl">
          {formatTemp(current.temp)}
        </span>
        <span className="mt-1 truncate text-sm text-foreground">
          {conditionLabel(current.condition)}
        </span>
        {delta ? (
          <span className={`truncate text-[11px] ${trendColor(delta.trend)}`}>
            {delta.text}
          </span>
        ) : null}
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

/** 시간별 — 가로 strip 또는 세로 목록(layout). */
function HourlyBody({
  hourly,
  layout,
}: {
  hourly: Weather["hourly"];
  layout: WeatherLayout;
}) {
  if (hourly.length === 0) {
    return (
      <p className="flex-1 text-sm text-muted-foreground">시간별 예보 없음</p>
    );
  }
  const items = hourly.slice(0, 12);
  if (layout === "vertical") {
    return (
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
        {items.map((h) => {
          const pop = formatPop(h.pop);
          return (
            <li
              key={h.ts}
              className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1"
            >
              <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
                {formatHour(h.ts)}
              </span>
              <ConditionIcon
                condition={h.condition}
                size={16}
                aria-label={conditionLabel(h.condition)}
                className="shrink-0 text-foreground"
              />
              <span className="ml-auto font-mono text-xs tabular-nums text-foreground">
                {formatTemp(h.temp)}
              </span>
              <span className="w-9 shrink-0 text-right text-[10px] text-muted-foreground">
                {pop ?? ""}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 items-center gap-1.5 overflow-x-auto pb-scroll">
      {items.map((h) => {
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

/** 주간 — 가로 나열(월·화·수…) 또는 세로 목록(layout). */
function DailyBody({
  daily,
  layout,
}: {
  daily: Weather["daily"];
  layout: WeatherLayout;
}) {
  if (daily.length === 0) {
    return <p className="flex-1 text-sm text-muted-foreground">주간 예보 없음</p>;
  }
  if (layout === "vertical") {
    return (
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
        {daily.map((d) => (
          <li
            key={d.date}
            className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1"
          >
            <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
              {formatDay(d.date)}
            </span>
            <ConditionIcon
              condition={d.condition}
              size={16}
              aria-label={conditionLabel(d.condition)}
              className="shrink-0 text-foreground"
            />
            <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-foreground">
              {formatTemp(d.tempMax)}
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatTemp(d.tempMin)}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-scroll">
      {daily.map((d) => (
        <li
          key={d.date}
          className="flex shrink-0 flex-col items-center gap-0.5 rounded-md border border-border bg-background/40 px-2 py-1.5"
        >
          <span className="text-[10px] text-muted-foreground">
            {formatDay(d.date)}
          </span>
          <ConditionIcon
            condition={d.condition}
            size={18}
            aria-label={conditionLabel(d.condition)}
            className="text-foreground"
          />
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {formatTemp(d.tempMax)}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatTemp(d.tempMin)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default WeatherCompactView;
