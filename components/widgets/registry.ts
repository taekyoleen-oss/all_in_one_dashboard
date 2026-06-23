/**
 * ============================================================================
 *  PaneBoard PRODUCTION widget registry (설계서 §9.4, §2.1–2.2)
 * ============================================================================
 *
 *  Shared module (no "use client"): the canvas (client) renders the View
 *  components, while the server first-login bootstrap (lib/supabase/queries/
 *  boards.ts) reads only the plain data (defaultConfig/defaultSize). The View
 *  fields are client references on the server and are never called there.
 *
 *  The single source of truth the canvas consumes: `type` → WidgetDefinition.
 *  The palette lists these, GridCanvas renders CompactView, FocusOverlay renders
 *  ExpandedView, and ConfigDialog renders ConfigEditor — all keyed by `type`.
 *
 *  ── Batch status ──────────────────────────────────────────────────────────
 *  Batch 1 (this file): memo, calculator, world-clock, dday.
 *  Batch 2 (next): todo, favorites, contacts, essential-info, image-slider.
 *  Batch 3 (API-backed): stock, weather, card-usage, fx, news, calendar.
 *
 *  To add a widget: build `components/widgets/{type}/` (CompactView, ExpandedView,
 *  ConfigEditor, index.ts exporting a WidgetDefinition), import its definition
 *  here, and add it to the `DEFINITIONS` array below. The map + page wiring need
 *  NO further changes — `register()` keys each entry by its own `type`.
 * ============================================================================
 */

import type {
  WidgetDefinition,
  WidgetRegistry,
} from "@/lib/widgets/contract";

import { memoWidget } from "./memo";
import { calculatorWidget } from "./calculator";
import { worldClockWidget } from "./world-clock";
import { ddayWidget } from "./dday";
import { todoWidget } from "./todo";
import { favoritesWidget } from "./favorites";
import { contactsWidget } from "./contacts";
import { essentialInfoWidget } from "./essential-info";
import { imageSliderWidget } from "./image-slider";
import { stockWidget } from "./stock";
import { fxWidget } from "./fx";
import { weatherWidget } from "./weather";
import { newsWidget } from "./news";
import { cardUsageWidget } from "./card-usage";
import { calendarWidget } from "./calendar";
import { clipboardWidget } from "./clipboard";
import { outfitWidget } from "./outfit";
import { upcomingWidget } from "./upcoming";
import { airQualityWidget } from "./air-quality";
import { subscriptionsWidget } from "./subscriptions";
import { unitConverterWidget } from "./unit-converter";
import { timerWidget } from "./timer";
import { sunMoonWidget } from "./sun-moon";
import { translateWidget } from "./translate";
import { vehicleWidget } from "./vehicle";

/**
 * Every widget definition, in no particular order — the palette sorts them
 * (core before extended, then alpha). Batch 2/3 widgets append here.
 */
const DEFINITIONS: WidgetDefinition[] = [
  // ── Batch 1 ──────────────────────────────────────────────
  memoWidget as WidgetDefinition,
  calculatorWidget as WidgetDefinition,
  worldClockWidget as WidgetDefinition,
  ddayWidget as WidgetDefinition,

  // ── Batch 2 (todo, favorites, contacts, essential-info, image-slider) ──
  todoWidget as WidgetDefinition,
  favoritesWidget as WidgetDefinition,
  contactsWidget as WidgetDefinition,
  essentialInfoWidget as WidgetDefinition,
  imageSliderWidget as WidgetDefinition,

  // ── Batch 3 (stock, weather, card-usage, fx, news, calendar) ──
  stockWidget as WidgetDefinition,
  weatherWidget as WidgetDefinition,
  fxWidget as WidgetDefinition,
  newsWidget as WidgetDefinition,
  cardUsageWidget as WidgetDefinition,
  calendarWidget as WidgetDefinition,

  // ── Extra utilities ──────────────────────────────────────
  clipboardWidget as WidgetDefinition,
  outfitWidget as WidgetDefinition,
  upcomingWidget as WidgetDefinition,

  // ── Batch 4 (대기질·구독·단위변환·타이머·일출달·번역·차량) ──
  airQualityWidget as WidgetDefinition,
  subscriptionsWidget as WidgetDefinition,
  unitConverterWidget as WidgetDefinition,
  timerWidget as WidgetDefinition,
  sunMoonWidget as WidgetDefinition,
  translateWidget as WidgetDefinition,
  vehicleWidget as WidgetDefinition,
];

/** Build the `type → definition` map, asserting unique type keys. */
function buildRegistry(defs: WidgetDefinition[]): WidgetRegistry {
  const map: Record<string, WidgetDefinition> = {};
  for (const def of defs) {
    if (map[def.type]) {
      throw new Error(`Duplicate widget type in registry: "${def.type}"`);
    }
    map[def.type] = def;
  }
  return map;
}

export const widgetRegistry: WidgetRegistry = buildRegistry(DEFINITIONS);

/** Convenience: the list of registered type keys (for tests/diagnostics). */
export const widgetTypes: string[] = Object.keys(widgetRegistry);

export default widgetRegistry;
