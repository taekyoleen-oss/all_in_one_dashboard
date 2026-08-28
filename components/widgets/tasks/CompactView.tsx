"use client";

/** 작업 타일 — 목록·추가·완료·삭제 전부 타일에서(본문 = TasksBody 공유). */

import type { CompactViewProps } from "@/lib/widgets/contract";
import { TasksBody } from "./TasksBody";
import type { TasksConfig } from "./types";

export function TasksCompactView({ config, instanceId }: CompactViewProps<TasksConfig>) {
  return (
    <TasksBody instanceId={instanceId} mobileSync={Boolean(config.mobileSync)} />
  );
}

export default TasksCompactView;
