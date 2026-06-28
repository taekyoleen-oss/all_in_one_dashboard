/**
 * upcoming — WidgetDefinition ("다가오는 내 일정"). 사용자가 직접 입력하는 심플한
 * 일정 목록을 오늘 이후·가까운 순으로 보여준다. dataMode: 'static'(로컬 계산),
 * copyBehavior: 'config'(일정 목록까지 복제).
 */

import { CalendarHeart } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { UpcomingCompactView } from "./CompactView";
import { UpcomingExpandedView } from "./ExpandedView";
import { UpcomingConfigEditor } from "./ConfigEditor";
import { DEFAULT_UPCOMING_CONFIG, type UpcomingConfig } from "./types";

export const upcomingWidget: WidgetDefinition<UpcomingConfig> = {
  type: "upcoming",
  displayName: "다가오는 일정",
  icon: CalendarHeart,
  category: "extended",
  defaultConfig: DEFAULT_UPCOMING_CONFIG,
  // minSize.w 5→3: 타일을 더 좁게 줄일 수 있도록(요구). EventRow·QuickAdd가
  // min-w-0 truncate·flex-wrap이라 좁아져도 깨지지 않고 줄어든다.
  defaultSize: { w: 8, h: 8 },
  minSize: { w: 3, h: 3 },
  maxSize: { w: 16, h: 24 },
  CompactView: UpcomingCompactView,
  ExpandedView: UpcomingExpandedView,
  ConfigEditor: UpcomingConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default upcomingWidget;
export type { UpcomingConfig } from "./types";
