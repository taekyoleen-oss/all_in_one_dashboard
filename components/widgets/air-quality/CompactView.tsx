"use client";

/**
 * air-quality · CompactView — headline PM grades for one location (대기질).
 *
 *  Shows the worse of PM₂.₅/PM₁₀ as a big grade (emoji + 좋음/보통/나쁨/매우나쁨 +
 *  color), then the two PM numbers as chips. Grade conveys severity by emoji +
 *  label + color (never color alone). Poll-mode: a RefreshBar shows the time.
 */

import * as React from "react";
import { Wind } from "lucide-react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { useAirQuality } from "./useAirQuality";
import { gradePm25, gradePm10, worseGrade } from "./grade";
import type { AirQualityConfig } from "./types";

function Pm({
  name,
  value,
  grade,
}: {
  name: string;
  value: number | undefined;
  grade: ReturnType<typeof gradePm25>;
}) {
  return (
    <div
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-md ${grade.bgClass} px-2 py-1.5`}
    >
      <span className="text-[10px] font-medium text-muted-foreground">{name}</span>
      <span className={`font-mono text-base font-semibold tabular-nums ${grade.textClass}`}>
        {value === undefined ? "—" : Math.round(value)}
      </span>
      <span className={`text-[10px] font-medium ${grade.textClass}`}>{grade.label}</span>
    </div>
  );
}

export function AirQualityCompactView({
  config,
}: CompactViewProps<AirQualityConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useAirQuality(config);

  const pm25 = data?.current.pm25;
  const pm10 = data?.current.pm10;
  const g25 = gradePm25(pm25);
  const g10 = gradePm10(pm10);
  const overall = worseGrade(g25, g10);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wind size={13} aria-hidden className="shrink-0" />
        <span className="truncate font-medium text-foreground">{config.label}</span>
      </div>

      {loading && !data ? (
        <p className="my-auto text-center text-sm text-muted-foreground">
          불러오는 중…
        </p>
      ) : error && !data ? (
        <p className="my-auto text-center text-sm text-muted-foreground">
          대기질 정보를 불러오지 못했습니다.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl @[220px]/widget:text-3xl" aria-hidden>
              {overall.emoji}
            </span>
            <span
              className={`text-xl font-semibold @[220px]/widget:text-2xl ${overall.textClass}`}
            >
              {overall.label}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Pm name="초미세 PM2.5" value={pm25} grade={g25} />
            <Pm name="미세 PM10" value={pm10} grade={g10} />
          </div>
        </div>
      )}

      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} />
    </div>
  );
}

export default AirQualityCompactView;
