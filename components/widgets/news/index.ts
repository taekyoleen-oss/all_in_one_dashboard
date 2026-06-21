/**
 * news — WidgetDefinition (설계서 §2.2 "뉴스/RSS"). dataMode: 'poll' (snapshot from
 * /api/news — Naver primary, keyless Google News RSS fallback). copyBehavior:
 * 'config' (duplicate the keyword).
 *
 *  All news types are IMPORTED from output/api-shapes.ts (the anti-drift single
 *  source) via the hook/views — never re-declared here.
 */

import { Newspaper } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { NewsCompactView } from "./CompactView";
import { NewsExpandedView } from "./ExpandedView";
import { NewsConfigEditor } from "./ConfigEditor";
import { NEWS_REFRESH_MS } from "./useNews";
import { DEFAULT_NEWS_CONFIG, type NewsConfig } from "./types";

export const newsWidget: WidgetDefinition<NewsConfig> = {
  type: "news",
  displayName: "뉴스",
  icon: Newspaper,
  category: "extended",
  defaultConfig: DEFAULT_NEWS_CONFIG,
  defaultSize: { w: 3, h: 4 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 8 },
  CompactView: NewsCompactView,
  ExpandedView: NewsExpandedView,
  ConfigEditor: NewsConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: NEWS_REFRESH_MS,
};

export default newsWidget;
export type { NewsConfig } from "./types";
