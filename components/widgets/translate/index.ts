/**
 * translate — WidgetDefinition (번역기). dataMode: 'static' (on-demand fetch, no
 * background poll). copyBehavior: 'config' (duplicate the language pair).
 *
 *  Response types are IMPORTED from output/api-shapes.ts (Translate) via the hook
 *  — never re-declared here.
 */

import { Languages } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { TranslateCompactView } from "./CompactView";
import { TranslateExpandedView } from "./ExpandedView";
import { TranslateConfigEditor } from "./ConfigEditor";
import { DEFAULT_TRANSLATE_CONFIG, type TranslateConfig } from "./types";

export const translateWidget: WidgetDefinition<TranslateConfig> = {
  type: "translate",
  displayName: "번역기",
  icon: Languages,
  category: "extended",
  defaultConfig: DEFAULT_TRANSLATE_CONFIG,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 4, h: 5 },
  maxSize: { w: 12, h: 16 },
  CompactView: TranslateCompactView,
  ExpandedView: TranslateExpandedView,
  ConfigEditor: TranslateConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default translateWidget;
export type { TranslateConfig } from "./types";
