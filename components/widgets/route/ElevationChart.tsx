"use client";

/**
 * ElevationChart — 출발↔도착 고도를 그래프로만 표시(요구 3).
 *
 *  차트 라이브러리 없이 SVG로 직접 그린다 — 면적 + 선 하나라 의존성을 들일 이유가 없다.
 *  X는 출발지로부터의 누적 거리, Y는 해발 고도. 현재 위치는 세로선 + 점으로 얹는다.
 *
 *  ⚠ 글자는 SVG 밖(HTML)에 둔다. 그래프는 타일 크기에 맞춰 가로세로가 따로 늘어나야
 *  해서 `preserveAspectRatio="none"`인데, 그러면 SVG 안의 <text>도 같이 찌그러진다
 *  (실브라우저에서 확인). 축 라벨은 flex로 옆에 붙이면 어떤 비율에서도 멀쩡하다.
 *
 *  ⚠ 정직성: 90m 해상도 DEM이라 계단·육교·지하보도는 잡히지 않고 도심 짧은 경로는
 *  거의 평평하게 나온다. 그래서 하단에 근사치임을 항상 밝힌다.
 */

import * as React from "react";
import type { WalkElevationPoint } from "@/output/api-shapes";
import { formatDistance } from "@/lib/widgets/route/geo";

/** 그래프 논리 좌표계. 가로세로가 독립적으로 늘어나므로 값 자체는 중요하지 않다. */
const W = 320;
const H = 100;
const PAD_Y = 6;

export function ElevationChart({
  points,
  currentDistance,
  source,
  className,
}: {
  points: WalkElevationPoint[];
  /** 현재 위치의 경로상 누적 거리(m). 없으면 표시하지 않는다. */
  currentDistance?: number | null;
  /** 고도 출처 표기(근사치 안내). */
  source?: string | null;
  className?: string;
}) {
  if (points.length < 2) return null;

  const totalDistance = points[points.length - 1].distance;
  const elevations = points.map((p) => p.elevation);
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  // 완전히 평평한 구간에서 0으로 나누지 않도록 최소 1m 폭을 준다.
  const span = Math.max(1, max - min);

  // 100개 이하의 덧셈이라 메모이제이션이 필요 없다.
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - elevations[i - 1];
    if (d > 0) gain += d;
  }
  gain = Math.round(gain);

  const x = (d: number) => (totalDistance === 0 ? 0 : (d / totalDistance) * W);
  const y = (e: number) => PAD_Y + (1 - (e - min) / span) * (H - PAD_Y * 2);

  const line = points.map((p) => `${x(p.distance).toFixed(1)},${y(p.elevation).toFixed(1)}`);
  const area = [`0,${H}`, ...line, `${W},${H}`].join(" ");

  // 현재 위치는 경로 범위 안일 때만 얹는다(이탈·범위 밖이면 그리지 않는다).
  const showCurrent =
    typeof currentDistance === "number" &&
    currentDistance >= 0 &&
    currentDistance <= totalDistance;
  const curX = showCurrent ? x(currentDistance) : 0;
  const curY = showCurrent
    ? y(
        points.reduce((best, p) =>
          Math.abs(p.distance - currentDistance) < Math.abs(best.distance - currentDistance)
            ? p
            : best,
        ).elevation,
      )
    : 0;

  return (
    <div className={`flex w-full flex-col gap-0.5 ${className ?? ""}`}>
      <div className="flex min-h-0 flex-1 gap-1">
        {/* 축 라벨은 SVG 밖 — 늘어나도 글자가 찌그러지지 않는다 */}
        <div className="flex w-8 shrink-0 flex-col justify-between text-right font-mono text-[10px] leading-none text-muted-foreground">
          <span>{Math.round(max)}m</span>
          <span>{Math.round(min)}m</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="min-w-0 flex-1"
          role="img"
          aria-label={`고도 그래프: 최저 ${Math.round(min)}m, 최고 ${Math.round(max)}m, 누적 상승 ${gain}m`}
        >
          <polygon points={area} className="fill-primary/20" />
          <polyline
            points={line.join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            // 세로로 늘어나도 선 두께가 굵어지지 않게.
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {showCurrent ? (
            <g>
              <line
                x1={curX}
                y1={0}
                x2={curX}
                y2={H}
                stroke="#3b82f6"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={curX}
                cy={curY}
                r={4}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ) : null}
        </svg>
      </div>

      {/* X축 양 끝 + 출처 — 한 줄로, 좁으면 잘리되 title로 전체를 남긴다 */}
      <div className="flex shrink-0 items-baseline gap-2 pl-9 text-[10px] leading-tight text-muted-foreground">
        <span className="shrink-0">출발</span>
        <span className="shrink-0 font-mono">{formatDistance(totalDistance)}</span>
        {source ? (
          <span className="ml-auto min-w-0 truncate" title={`누적 상승 ${gain}m · ${source}`}>
            ↑{gain}m · 근사치
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default ElevationChart;
