"use client";

/**
 * RouteBody — 타일과 전체보기가 공유하는 본체(지도 + 고도 그래프 + 요약).
 *
 *  두 뷰의 차이는 `expanded` 하나뿐이다: 전체보기는 지도를 크게 쓰고 안내 지점
 *  목록을 덧붙이며, 현재 위치를 **watch**로 따라간다(타일은 1회 조회).
 *
 *  상태를 조용히 삼키지 않는다 — 목적지 미설정·위치 권한 거부·서비스 지역 밖은
 *  각각 다른 문구로 알린다. 특히 지역 밖은 서버가 준 문구를 그대로 보여준다
 *  (티맵 보행자 경로는 전국이 아니다).
 */

import * as React from "react";
import { MapPin, Navigation, TriangleAlert } from "lucide-react";
import { projectOntoPath, formatDistance, formatDuration, type LonLat } from "@/lib/widgets/route/geo";
import { nextGuidance } from "@/lib/widgets/route/guidance";
import { NextGuidance } from "./NextGuidance";
import { RouteMap } from "./RouteMap";
import { ElevationChart } from "./ElevationChart";
import { useWalkRoute } from "./useWalkRoute";
import { useCurrentPosition } from "./useCurrentPosition";
import type { RouteConfig, RoutePlace } from "./types";

/** 경로에서 이만큼(m) 넘게 떨어지면 현재 위치를 경로 위에 찍지 않는다. */
const BASE_OFF_ROUTE_M = 50;

function Notice({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string | null;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center">
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {detail ? (
        <p className="text-xs leading-snug text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

export function RouteBody({
  config,
  expanded = false,
}: {
  config: RouteConfig;
  expanded?: boolean;
}) {
  const usesGps = config.start === null;
  // 목적지가 있을 때만 위치를 요청한다 — 설정도 안 한 위젯이 권한 창을 띄우지 않도록.
  const gps = useCurrentPosition({
    enabled: Boolean(config.end),
    watch: expanded,
  });

  const origin: RoutePlace | null = React.useMemo(() => {
    if (config.start) return config.start;
    if (!gps.position) return null;
    return { label: "현재 위치", lat: gps.position.lat, lon: gps.position.lon };
  }, [config.start, gps.position]);

  // 출발지 잠금을 풀고 현재 위치에서 다시 계산하기 위한 카운터('경로 다시 계산').
  const [retryKey, setRetryKey] = React.useState(0);
  const route = useWalkRoute(origin, config.end, config.avoidStairs, retryKey);

  // 현재 위치를 경로에 투영 — 지도 점과 고도 그래프의 세로선이 같은 값을 쓴다.
  const here = React.useMemo(() => {
    if (!route.data || !gps.position) return null;
    const p = projectOntoPath(
      route.data.path as LonLat[],
      [gps.position.lon, gps.position.lat],
    );
    // GPS 정확도가 나쁘면 그만큼 관대하게 본다(정확도 50m인데 40m 벗어났다고
    // 이탈로 단정하면 오판이다).
    const limit = Math.max(BASE_OFF_ROUTE_M, gps.position.accuracy);
    return { ...p, onRoute: p.offset <= limit };
  }, [route.data, gps.position]);

  // 다음 안내(요구 2) — 경로를 다시 부르지 않고, 투영된 거리로만 다시 계산한다.
  const guide = React.useMemo(() => {
    if (!route.data || !here) return null;
    return nextGuidance(route.data.steps, here.distanceAlong, route.data.totalDistance);
  }, [route.data, here]);

  /* ── 안내가 필요한 상태들 ─────────────────────────────────────────────── */

  if (!config.end) {
    return (
      <Notice
        icon={<MapPin size={20} />}
        title="도착지를 설정하세요"
        detail="⋮ 메뉴 > 편집에서 도착지를 지정하면 도보 경로와 고도가 표시됩니다."
      />
    );
  }
  if (usesGps && gps.error) {
    return <Notice icon={<TriangleAlert size={20} />} title="위치를 사용할 수 없음" detail={gps.error} />;
  }
  if (!origin) {
    return <Notice icon={<Navigation size={20} />} title="현재 위치 확인 중…" />;
  }
  if (route.loading) {
    return <Notice icon={<Navigation size={20} />} title="도보 경로를 찾는 중…" />;
  }
  if (route.error && !route.data) {
    return (
      <Notice
        icon={<TriangleAlert size={20} />}
        title="경로를 표시할 수 없음"
        // 서버가 이유를 아는 경우(지역 밖·키 미설정 등)엔 그 문구가 정확하다.
        detail={route.message ?? "잠시 후 다시 시도해 주세요."}
      />
    );
  }
  if (!route.data) return null;

  const data = route.data;

  return (
    // 전체보기는 지도가 주인공이라 최소 높이를 보장하고, 그래도 안 들어가면 세로로
    // 스크롤한다(짧은 화면에서 지도가 몇십 px로 찌그러지던 문제 — 실브라우저에서 확인).
    <div
      className={`flex h-full w-full flex-col gap-1.5 ${
        expanded ? "overflow-y-auto pb-scroll" : ""
      }`}
    >
      {/* 요약 */}
      <div className="flex shrink-0 items-center gap-1.5 text-xs">
        <Navigation size={12} aria-hidden className="shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">
          {origin.label} → {config.end.label}
        </span>
        <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
          {formatDistance(data.totalDistance)} · {formatDuration(data.totalTime)}
        </span>
      </div>

      {/* 다음 안내(요구 2) — 전체보기에서 현재 위치를 따라가며 갱신된다.
          위치를 못 쓰면 왜 안내가 없는지 밝힌다(조용히 비워두지 않는다). */}
      {expanded && gps.error ? (
        <p className="shrink-0 rounded-md border border-border bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
          위치를 사용할 수 없어 실시간 안내를 표시하지 않습니다 — {gps.error}
        </p>
      ) : expanded && guide ? (
        <NextGuidance
          step={guide.step}
          toStep={guide.toStep}
          toEnd={guide.toEnd}
          arrived={guide.arrived}
          offRouteBy={here && !here.onRoute ? here.offset : null}
          onReroute={() => setRetryKey((n) => n + 1)}
          canReroute={usesGps}
        />
      ) : null}

      {/* 지도 — 남는 세로 공간을 전부 쓴다 */}
      <RouteMap
        path={data.path as LonLat[]}
        bounds={data.bounds}
        current={here?.onRoute ? (here.snapped as LonLat) : null}
        className={expanded ? "min-h-[260px] flex-1" : "min-h-0 flex-1"}
      />

      {/* 고도 그래프 */}
      {data.elevation.length > 1 ? (
        <ElevationChart
          points={data.elevation}
          currentDistance={here?.onRoute ? here.distanceAlong : null}
          source={data.elevationSource}
          className={expanded ? "h-28 shrink-0" : "h-20 shrink-0"}
        />
      ) : null}

      {/* 전체보기: 안내 지점 목록 */}
      {expanded ? (
        <ol className="max-h-40 shrink-0 overflow-y-auto pb-scroll text-xs">
          {data.steps.map((s) => (
            <li
              key={s.index}
              className="flex items-baseline gap-2 border-t border-border/60 py-1 first:border-t-0"
            >
              <span className="shrink-0 font-mono tabular-nums text-[10px] text-muted-foreground">
                {formatDistance(s.distanceFromStart)}
              </span>
              <span className="min-w-0 flex-1 text-foreground">
                {s.description || s.name || "—"}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export default RouteBody;
