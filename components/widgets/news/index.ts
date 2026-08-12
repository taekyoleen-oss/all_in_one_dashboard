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
import {
  DEFAULT_NEWS_CONFIG,
  newsInstanceTitle,
  type NewsConfig,
} from "./types";

export const newsWidget: WidgetDefinition<NewsConfig> = {
  type: "news",
  displayName: "뉴스",
  icon: Newspaper,
  category: "extended",
  defaultConfig: DEFAULT_NEWS_CONFIG,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: NewsCompactView,
  ExpandedView: NewsExpandedView,
  ConfigEditor: NewsConfigEditor,
  // 헤더·전체보기 제목에 설정한 검색어를 노출한다("뉴스 (보험 검색)").
  // 더블클릭 제목 변경은 config.title에 저장돼 검색어를 바꿔도 유지된다.
  instanceTitle: newsInstanceTitle,
  renameInstance: (config, title) => ({ ...config, title: title.trim() }),
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: NEWS_REFRESH_MS,
};

export default newsWidget;
export type { NewsConfig } from "./types";
