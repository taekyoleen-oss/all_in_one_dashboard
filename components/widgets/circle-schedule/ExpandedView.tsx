"use client";

/**
 * circle-schedule · ExpandedView — 전체 화면. 타일과 같은 SchedulePanel을 넓게
 * 렌더(붙여넣기 영역·검토 목록에 더 넉넉한 공간).
 */

import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { SchedulePanel } from "./SchedulePanel";
import type { CircleScheduleConfig } from "./types";

export function CircleScheduleExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<CircleScheduleConfig>) {
  return (
    <div className="mx-auto h-full min-h-[50dvh] w-full max-w-2xl">
      <SchedulePanel config={config} instanceId={instanceId} size="expanded" />
    </div>
  );
}

export default CircleScheduleExpandedView;
