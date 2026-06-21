/**
 * card-usage — WidgetDefinition (설계서 §2.1 #9 "카드 사용현황", §5.4, §6.4).
 *
 *  dataMode:'static' — a READ-ONLY snapshot over the user's own
 *  `pb_card_transactions` + `pb_cards`, read via the browser client (RLS-scoped)
 *  and aggregated client-side. No polling/stream. copyBehavior:'config'
 *  (duplicate the card filter + trend settings). sensitive:true — renders
 *  personal spend; masking/log-hygiene apply and the last4-only rule is enforced
 *  in the ConfigEditor.
 *
 *  All transaction/summary types are IMPORTED from output/api-shapes.ts (the
 *  anti-drift single source) — never re-declared here.
 */

import { CreditCard } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { CardUsageCompactView } from "./CompactView";
import { CardUsageExpandedView } from "./ExpandedView";
import { CardUsageConfigEditor } from "./ConfigEditor";
import { DEFAULT_CARD_USAGE_CONFIG, type CardUsageConfig } from "./types";

export const cardUsageWidget: WidgetDefinition<CardUsageConfig> = {
  type: "card-usage",
  displayName: "카드 사용현황",
  icon: CreditCard,
  category: "core",
  defaultConfig: DEFAULT_CARD_USAGE_CONFIG,
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 8 },
  CompactView: CardUsageCompactView,
  ExpandedView: CardUsageExpandedView,
  ConfigEditor: CardUsageConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
  sensitive: true,
};

export default cardUsageWidget;
export type { CardUsageConfig } from "./types";
