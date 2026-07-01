"use client";

/**
 * circle-schedule · CompactView — 캔버스 타일. 대상별 필터 + 약속 목록 + 카카오톡
 * 정리 흐름을 SchedulePanel에 위임한다.
 */

import type { CompactViewProps } from "@/lib/widgets/contract";
import { SchedulePanel } from "./SchedulePanel";
import type { CircleScheduleConfig } from "./types";

export function CircleScheduleCompactView({
  config,
  instanceId,
}: CompactViewProps<CircleScheduleConfig>) {
  return <SchedulePanel config={config} instanceId={instanceId} size="compact" />;
}

export default CircleScheduleCompactView;
