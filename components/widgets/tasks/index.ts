/**
 * tasks — WidgetDefinition (작업). 데이터는 pb_tasks 테이블(RLS, realtime) —
 * 웹 캔버스와 안드로이드 홈 화면 위젯(/api/widget/tasks)이 같은 행을 양방향 동기화.
 * dataMode:'static' (서버 API 폴링 없음 — supabase 직접 + realtime).
 */

import { ListChecks } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { TasksCompactView } from "./CompactView";
import { TasksExpandedView } from "./ExpandedView";
import { TasksConfigEditor } from "./ConfigEditor";
import { DEFAULT_TASKS_CONFIG, type TasksConfig } from "./types";

export const tasksWidget: WidgetDefinition<TasksConfig> = {
  type: "tasks",
  displayName: "작업",
  icon: ListChecks,
  category: "extended",
  defaultConfig: DEFAULT_TASKS_CONFIG,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: TasksCompactView,
  ExpandedView: TasksExpandedView,
  ConfigEditor: TasksConfigEditor,
  // 복제해도 작업 행은 인스턴스별이라 딸려가지 않는다 — 설정만 복사.
  copyBehavior: "config",
  dataMode: "static",
};

export default tasksWidget;
export type { TasksConfig } from "./types";
