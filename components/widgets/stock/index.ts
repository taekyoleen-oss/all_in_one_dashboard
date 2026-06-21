/**
 * stock — WidgetDefinition (설계서 §2.1 "주식 뷰어"). dataMode: 'stream' (live
 * quotes via SSE /api/stocks/stream with a poll fallback to /api/stocks).
 * copyBehavior: 'config' (duplicate the symbol selection).
 *
 *  All quote types are IMPORTED from output/api-shapes.ts (the anti-drift single
 *  source) via the hook/views — never re-declared here.
 */

import { TrendingUp } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { StockCompactView } from "./CompactView";
import { StockExpandedView } from "./ExpandedView";
import { StockConfigEditor } from "./ConfigEditor";
import { DEFAULT_STOCK_CONFIG, type StockConfig } from "./types";

export const stockWidget: WidgetDefinition<StockConfig> = {
  type: "stock",
  displayName: "주식",
  icon: TrendingUp,
  category: "core",
  defaultConfig: DEFAULT_STOCK_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: StockCompactView,
  ExpandedView: StockExpandedView,
  ConfigEditor: StockConfigEditor,
  copyBehavior: "config",
  dataMode: "stream",
};

export default stockWidget;
export type { StockConfig } from "./types";
