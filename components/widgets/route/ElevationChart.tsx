"use client";

/**
 * ElevationChart — 출발↔도착 고도를 그래프로만 표시(요구 3).
 *
 *  차트 라이브러리 없이 SVG로 직접 그린다 — 면적 + 선 하나라 의존성을 들일 이유가 없다.
 *  X는 출발지로부터의 누적 거리, Y는 해발 고도. 현재 위치는 세로선 + 점으로 얹는다.
 *
 *  ⚠ 세로 축의 폭은 `elevationDomain`이 정한다(하한 있음). 실제 최저~최고에 꽉 맞추면
 *  3m짜리 굴곡도 산처럼 보이기 때문이다 — 평지에 가까운 길은 평평하게 보여야 한다.
 *
 *  ⚠ 글자는 SVG 밖(HTML)에 둔다. 그래프는 타일 크기에 맞춰 가로세로가 따로 늘어나야
 *  해서 `preserveAspectRatio="none"`인데, 그러면 SVG 안의 <text>도 같이 찌그러진다
 *  (실브라우저에서 확인). 축 라벨은 선이 실제로 놓인 높이에 맞춰 절대 배치한다.
 *
 *  ⚠ 정직성: 데이터는 90m 해상도 DEM이라 계단·육교·지하보도는 잡히지 않는다.
 *    거의 평지일 때는 누적 상승도 알리지 않는다 — 잔떨림이 합산돼 실제보다 험한
 *    길처럼 보이기 때문이다.
 */

import * as React from "react";
import type { WalkElevationPoint } from "@/output/api-shapes";
import { formatDistance } from "@/lib/widgets/route/geo";
import { elevationDomain, elevationRatio } from "@/lib/widgets/route/elevation";

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
  const domain = elevationDomain(points);

  const x = (d: number) => (totalDistance === 0 ? 0 : (d / totalDistance) * W);
  /** 고도 → SVG y. 비율 계산은 라벨과 공유한다(둘이 어긋나지 않도록). */
  const y = (e: number) => PAD_Y + elevationRatio(e, domain) * (H - PAD_Y * 2);
  /** 고도 → 컨테이너 높이 기준 % (HTML 라벨 배치용). */
  const topPct = (e: number) =>
    ((PAD_Y + elevationRatio(e, domain) * (H - PAD_Y * 2)) / H) * 100;

  const line = points.map(
    (p) => `${x(p.distance).toFixed(1)},${y(p.elevation).toFixed(1)}`,
  );
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
          Math.abs(p.distance - currentDistance) <
          Math.abs(best.distance - currentDistance)
            ? p
            : best,
        ).elevation,
      )
    : 0;

  return (
    <div className={`flex w-full flex-col gap-0.5 ${className ?? ""}`}>
      <div className="relative flex min-h-0 flex-1">
        {/* 축 라벨은 SVG 밖 — 늘어나도 글자가 찌그러지지 않고, 선이 실제로 놓인
            높이를 따라간다(범위 하한 때문에 선이 위아래 끝에 닿지 않을 수 있다). */}
        <div className="relative w-8 shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
          {domain.flat ? (
            <span
              className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${topPct((domain.min + domain.max) / 2)}%` }}
            >
              약 {Math.round((domain.min + domain.max) / 2)}m
            </span>
          ) : (
            <>
              <span
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${topPct(domain.max)}%` }}
              >
                {Math.round(domain.max)}m
              </span>
              <span
                className="absolute right-0 -translate-y-1/2"
                style={{ top: `${topPct(domain.min)}%` }}
              >
                {Math.round(domain.min)}m
              </span>
            </>
          )}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="ml-1 min-w-0 flex-1"
          role="img"
          aria-label={
            domain.flat
              ? `고도 그래프: 거의 평지(고저차 ${Math.round(domain.range)}m)`
              : `고도 그래프: 최저 ${Math.round(domain.min)}m, 최고 ${Math.round(domain.max)}m, 누적 상승 ${domain.gain}m`
          }
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

      {/* X축 양 끝 + 요약 — 좁으면 잘리되 title로 전체를 남긴다 */}
      <div className="flex shrink-0 items-baseline gap-2 pl-9 text-[10px] leading-tight text-muted-foreground">
        <span className="shrink-0">출발</span>
        <span className="shrink-0 font-mono">{formatDistance(totalDistance)}</span>
        {source ? (
          <span
            className="ml-auto min-w-0 truncate"
            title={
              domain.flat
                ? `고저차 ${Math.round(domain.range)}m · ${source}`
                : `누적 상승 ${domain.gain}m · ${source}`
            }
          >
            {/* 거의 평지면 누적 상승을 말하지 않는다 — DEM 잔떨림이 합산돼 과장된다. */}
            {domain.flat ? "거의 평지 · 근사치" : `↑${domain.gain}m · 근사치`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default ElevationChart;
