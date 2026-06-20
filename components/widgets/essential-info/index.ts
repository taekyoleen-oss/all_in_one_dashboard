/**
 * essential-info — WidgetDefinition (설계서 §2.1 #6, §5.2/§5.3 D5). dataMode: 'static'.
 * sensitive: true (masking/redaction & log hygiene). copyBehavior: 'custom' (copy
 * a single field value via the in-view copy buttons). The ConfigEditor surfaces a
 * prominent D5 warning (진짜 민감정보 저장 금지; 중간 수준만).
 */

import { ShieldAlert } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { EssentialInfoCompactView } from "./CompactView";
import { EssentialInfoExpandedView } from "./ExpandedView";
import { EssentialInfoConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_ESSENTIAL_INFO_CONFIG,
  type EssentialInfoConfig,
} from "./types";

export const essentialInfoWidget: WidgetDefinition<EssentialInfoConfig> = {
  type: "essential-info",
  displayName: "필수정보",
  icon: ShieldAlert,
  category: "core",
  defaultConfig: DEFAULT_ESSENTIAL_INFO_CONFIG,
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 6, h: 6 },
  CompactView: EssentialInfoCompactView,
  ExpandedView: EssentialInfoExpandedView,
  ConfigEditor: EssentialInfoConfigEditor,
  copyBehavior: "custom",
  dataMode: "static",
  sensitive: true,
};

export default essentialInfoWidget;
export type { EssentialInfoConfig } from "./types";
