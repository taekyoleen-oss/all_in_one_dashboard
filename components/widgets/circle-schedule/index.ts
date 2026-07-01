/**
 * circle-schedule — WidgetDefinition. "지인 일정 정리": 카카오톡 텍스트를 붙여넣어
 * 약속을 한 문장으로 추출(LLM)하고, 대상(구분)별로 정리·확인하는 위젯.
 *
 * dataMode: 'static'(온디맨드 LLM 추출). copyBehavior: 'config'. sensitive: true
 * (지인 일정 — 개인정보). 데이터는 Supabase(pb_circle_*)에 사용자별 RLS로 저장.
 */

import { CalendarClock } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { CircleScheduleCompactView } from "./CompactView";
import { CircleScheduleExpandedView } from "./ExpandedView";
import { CircleScheduleConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_CIRCLE_SCHEDULE_CONFIG,
  type CircleScheduleConfig,
} from "./types";

export const circleScheduleWidget: WidgetDefinition<CircleScheduleConfig> = {
  type: "circle-schedule",
  displayName: "지인 일정 정리",
  icon: CalendarClock,
  category: "extended",
  defaultConfig: DEFAULT_CIRCLE_SCHEDULE_CONFIG,
  defaultSize: { w: 8, h: 12 },
  minSize: { w: 4, h: 6 },
  maxSize: { w: 16, h: 24 },
  CompactView: CircleScheduleCompactView,
  ExpandedView: CircleScheduleExpandedView,
  ConfigEditor: CircleScheduleConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
  sensitive: true,
};

export default circleScheduleWidget;
export type { CircleScheduleConfig } from "./types";
