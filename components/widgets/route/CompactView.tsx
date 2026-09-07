"use client";

/**
 * route · CompactView — 타일: 지도(경로선) + 고도 그래프 + 거리·시간 요약.
 * 본체는 RouteBody가 전체보기와 공유한다(타일은 안내 목록·위치 추적 없음).
 */

import type { CompactViewProps } from "@/lib/widgets/contract";
import { RouteBody } from "./RouteBody";
import type { RouteConfig } from "./types";

export function RouteCompactView({ config }: CompactViewProps<RouteConfig>) {
  return <RouteBody config={config} />;
}

export default RouteCompactView;
