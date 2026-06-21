/**
 * calendar — WidgetDefinition (설계서 §2.2 "캘린더", §3.3, §11.1).
 *
 *  dataMode:'poll' (snapshot of upcoming events from /api/calendar). Auth is
 *  email magic link, so this widget needs a SEPARATE Google connection
 *  (needsGoogleScope:true): the owner links Google with the `calendar.readonly`
 *  scope from the ConfigEditor, and the server reads the resulting provider token
 *  to fetch events. Until then the widget degrades to a "Google 연결" CTA — it
 *  never crashes or blocks the canvas.
 *
 *  copyBehavior:'config' (duplicate the display options). All event types are
 *  IMPORTED from output/api-shapes.ts (the anti-drift single source) via the
 *  hook/views — never re-declared here.
 */

import { CalendarDays } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { CalendarCompactView } from "./CompactView";
import { CalendarExpandedView } from "./ExpandedView";
import { CalendarConfigEditor } from "./ConfigEditor";
import { CALENDAR_REFRESH_MS } from "./useCalendar";
import { DEFAULT_CALENDAR_CONFIG, type CalendarConfig } from "./types";

export const calendarWidget: WidgetDefinition<CalendarConfig> = {
  type: "calendar",
  displayName: "캘린더",
  icon: CalendarDays,
  category: "extended",
  defaultConfig: DEFAULT_CALENDAR_CONFIG,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: CalendarCompactView,
  ExpandedView: CalendarExpandedView,
  ConfigEditor: CalendarConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: CALENDAR_REFRESH_MS,
  needsGoogleScope: true,
};

export default calendarWidget;
export type { CalendarConfig } from "./types";
