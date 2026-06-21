/**
 * fx — WidgetDefinition (설계서 §2.2 "환율"). dataMode: 'poll' (snapshot from the
 * keyless Frankfurter source via /api/fx; direction derived client-side across
 * polls). copyBehavior: 'config' (duplicate the base + quote selection).
 *
 *  All rate types are IMPORTED from output/api-shapes.ts (the anti-drift single
 *  source) via the hook/views — never re-declared here.
 */

import { ArrowRightLeft } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { FxCompactView } from "./CompactView";
import { FxExpandedView } from "./ExpandedView";
import { FxConfigEditor } from "./ConfigEditor";
import { FX_REFRESH_MS } from "./useFxRates";
import { DEFAULT_FX_CONFIG, type FxConfig } from "./types";

export const fxWidget: WidgetDefinition<FxConfig> = {
  type: "fx",
  displayName: "환율",
  icon: ArrowRightLeft,
  category: "extended",
  defaultConfig: DEFAULT_FX_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: FxCompactView,
  ExpandedView: FxExpandedView,
  ConfigEditor: FxConfigEditor,
  copyBehavior: "config",
  dataMode: "poll",
  refreshInterval: FX_REFRESH_MS,
};

export default fxWidget;
export type { FxConfig } from "./types";
