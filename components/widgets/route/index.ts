/**
 * route(길찾기) — WidgetDefinition.
 *
 *  도보 경로를 지도에 그리고(요구 1), 전체보기에서 현재 위치 기준 다음 안내를 보여주며
 *  (요구 2), 출발↔도착 고도를 그래프로 표시한다(요구 3).
 *
 *  dataMode 'poll'이지만 주기는 24시간 — 도보 경로는 하루 단위로 바뀌지 않는다
 *  (계획서 §3 "경로는 한 번만 부른다"). 응답 shape는 output/api-shapes.ts의
 *  WalkRoute를 import해 쓰며 위젯에서 재선언하지 않는다.
 */

import { Footprints } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { RouteCompactView } from "./CompactView";
import { RouteExpandedView } from "./ExpandedView";
import { RouteConfigEditor } from "./ConfigEditor";
import { WALK_REFRESH_MS } from "./useWalkRoute";
import { DEFAULT_ROUTE_CONFIG, type RouteConfig } from "./types";

export const routeWidget: WidgetDefinition<RouteConfig> = {
  type: "walk-route",
  displayName: "길찾기",
  icon: Footprints,
  category: "extended",
  defaultConfig: DEFAULT_ROUTE_CONFIG,
  // 지도 + 고도 그래프 + 요약이 함께 보이려면 세로가 넉넉해야 한다(outfit 선례).
  defaultSize: { w: 8, h: 16 },
  minSize: { w: 4, h: 8 },
  maxSize: { w: 16, h: 24 },
  CompactView: RouteCompactView,
  ExpandedView: RouteExpandedView,
  ConfigEditor: RouteConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: WALK_REFRESH_MS,
};

export default routeWidget;
export type { RouteConfig } from "./types";
