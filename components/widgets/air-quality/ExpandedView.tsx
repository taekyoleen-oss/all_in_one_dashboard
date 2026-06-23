"use client";

/**
 * air-quality · ExpandedView — full pollutant breakdown (대기질).
 *
 *  Big overall grade + a grid of all measured pollutants (PM₂.₅/PM₁₀/O₃/NO₂/
 *  SO₂/CO + European AQI). Each graded pollutant shows emoji + label + color.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { useAirQuality } from "./useAirQuality";
import {
  gradePm25,
  gradePm10,
  gradeO3,
  gradeNo2,
  worseGrade,
  type AirGrade,
} from "./grade";
import type { AirQualityConfig } from "./types";

function Cell({
  name,
  unit,
  value,
  grade,
}: {
  name: string;
  unit: string;
  value: number | undefined;
  grade?: AirGrade;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card/60 p-3">
      <span className="text-xs text-muted-foreground">{name}</span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
        {value === undefined ? "—" : Math.round(value)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
      </span>
      {grade ? (
        <span className={`text-xs font-medium ${grade.textClass}`}>
          {grade.emoji} {grade.label}
        </span>
      ) : null}
    </div>
  );
}

export function AirQualityExpandedView({
  config,
}: ExpandedViewProps<AirQualityConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useAirQuality(config);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  }
  if ((error && !data) || !data) {
    return (
      <p className="text-sm text-muted-foreground">
        대기질 정보를 불러오지 못했습니다.
      </p>
    );
  }

  const c = data.current;
  const g25 = gradePm25(c.pm25);
  const g10 = gradePm10(c.pm10);
  const gO3 = gradeO3(c.o3);
  const gNo2 = gradeNo2(c.no2);
  const overall = worseGrade(worseGrade(g25, g10), worseGrade(gO3, gNo2));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-card/60 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{data.location.label}</span>
          <span className="text-xs text-muted-foreground">통합 대기 상태</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-4xl" aria-hidden>
            {overall.emoji}
          </span>
          <span className={`text-3xl font-semibold ${overall.textClass}`}>
            {overall.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Cell name="초미세먼지 PM2.5" unit="㎍/㎥" value={c.pm25} grade={g25} />
        <Cell name="미세먼지 PM10" unit="㎍/㎥" value={c.pm10} grade={g10} />
        <Cell name="오존 O₃" unit="㎍/㎥" value={c.o3} grade={gO3} />
        <Cell name="이산화질소 NO₂" unit="㎍/㎥" value={c.no2} grade={gNo2} />
        <Cell name="아황산가스 SO₂" unit="㎍/㎥" value={c.so2} />
        <Cell name="일산화탄소 CO" unit="㎍/㎥" value={c.co} />
      </div>

      {c.euAqi !== undefined ? (
        <p className="text-xs text-muted-foreground">
          유럽 AQI 지수: <span className="font-medium text-foreground">{Math.round(c.euAqi)}</span>
          {c.usAqi !== undefined ? ` · 미국 AQI: ${Math.round(c.usAqi)}` : ""}
        </p>
      ) : null}

      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} size="expanded" />
      <p className="text-[11px] text-muted-foreground">
        등급은 환경부 통합대기환경지수(PM 기준) 좋음·보통·나쁨·매우나쁨 4단계입니다. 데이터: Open-Meteo.
      </p>
    </div>
  );
}

export default AirQualityExpandedView;
