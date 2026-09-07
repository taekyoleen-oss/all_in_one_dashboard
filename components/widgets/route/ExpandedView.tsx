"use client";

/**
 * route · ExpandedView — 전체보기: 큰 지도 + 고도 그래프 + 안내 지점 목록.
 * 현재 위치를 watch로 따라간다(타일은 1회 조회).
 */

import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { RouteBody } from "./RouteBody";
import type { RouteConfig } from "./types";

export function RouteExpandedView({ config }: ExpandedViewProps<RouteConfig>) {
  return <RouteBody config={config} expanded />;
}

export default RouteExpandedView;
