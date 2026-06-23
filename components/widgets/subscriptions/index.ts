/**
 * subscriptions — WidgetDefinition (구독 관리). dataMode: 'static' (computed
 * locally with date-fns from config). copyBehavior: 'config' (duplicate the
 * subscription list).
 */

import { CreditCard } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { SubscriptionsCompactView } from "./CompactView";
import { SubscriptionsExpandedView } from "./ExpandedView";
import { SubscriptionsConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_SUBSCRIPTIONS_CONFIG,
  type SubscriptionsConfig,
} from "./types";

export const subscriptionsWidget: WidgetDefinition<SubscriptionsConfig> = {
  type: "subscriptions",
  displayName: "구독 관리",
  icon: CreditCard,
  category: "extended",
  defaultConfig: DEFAULT_SUBSCRIPTIONS_CONFIG,
  defaultSize: { w: 6, h: 6 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 12, h: 16 },
  CompactView: SubscriptionsCompactView,
  ExpandedView: SubscriptionsExpandedView,
  ConfigEditor: SubscriptionsConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default subscriptionsWidget;
export type { SubscriptionsConfig } from "./types";
