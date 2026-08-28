"use client";

/** 작업 전체보기 — 타일과 같은 본문(더 큰 글씨). 데이터는 realtime으로 동기화. */

import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { TasksBody } from "./TasksBody";
import type { TasksConfig } from "./types";

export function TasksExpandedView({ config, instanceId }: ExpandedViewProps<TasksConfig>) {
  return (
    <div className="flex h-full flex-col p-1">
      <TasksBody instanceId={instanceId} mobileSync={Boolean(config.mobileSync)} large />
    </div>
  );
}

export default TasksExpandedView;
