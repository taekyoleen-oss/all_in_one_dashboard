/**
 * calculator — WidgetDefinition (설계서 §2.1 #8). dataMode: 'static'.
 * copyBehavior: 'custom' (the in-widget "결과 복사" button copies the last result).
 * Evaluation uses a restricted mathjs scope (see ./evaluate.ts).
 */

import { Calculator } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { CalculatorCompactView } from "./CompactView";
import { CalculatorExpandedView } from "./ExpandedView";
import { CalculatorConfigEditor } from "./ConfigEditor";
import { DEFAULT_CALCULATOR_CONFIG, type CalculatorConfig } from "./types";

export const calculatorWidget: WidgetDefinition<CalculatorConfig> = {
  type: "calculator",
  displayName: "계산기",
  icon: Calculator,
  category: "core",
  defaultConfig: DEFAULT_CALCULATOR_CONFIG,
  defaultSize: { w: 6, h: 8 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 10, h: 12 },
  CompactView: CalculatorCompactView,
  ExpandedView: CalculatorExpandedView,
  ConfigEditor: CalculatorConfigEditor,
  copyBehavior: "custom",
  dataMode: "static",
};

export default calculatorWidget;
export type { CalculatorConfig } from "./types";
