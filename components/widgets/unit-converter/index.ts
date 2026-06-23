/**
 * unit-converter — WidgetDefinition (단위/환산 변환). dataMode: 'static' (pure
 * local conversion). copyBehavior: 'config' (duplicate the selected units).
 */

import { Ruler } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { UnitConverterCompactView } from "./CompactView";
import { UnitConverterExpandedView } from "./ExpandedView";
import { UnitConverterConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_UNIT_CONVERTER_CONFIG,
  type UnitConverterConfig,
} from "./types";

export const unitConverterWidget: WidgetDefinition<UnitConverterConfig> = {
  type: "unit-converter",
  displayName: "단위 변환",
  icon: Ruler,
  category: "extended",
  defaultConfig: DEFAULT_UNIT_CONVERTER_CONFIG,
  defaultSize: { w: 5, h: 6 },
  minSize: { w: 4, h: 4 },
  maxSize: { w: 12, h: 14 },
  CompactView: UnitConverterCompactView,
  ExpandedView: UnitConverterExpandedView,
  ConfigEditor: UnitConverterConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default unitConverterWidget;
export type { UnitConverterConfig } from "./types";
