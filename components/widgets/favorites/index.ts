/**
 * favorites — WidgetDefinition (설계서 §2.1 #3). dataMode: 'static'.
 * copyBehavior: 'config' (duplicate the link list). Favicons via a public service
 * with a letter-avatar fallback (no API key, degrades offline).
 */

import { Star } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { FavoritesCompactView } from "./CompactView";
import { FavoritesExpandedView } from "./ExpandedView";
import { FavoritesConfigEditor } from "./ConfigEditor";
import { DEFAULT_FAVORITES_CONFIG, type FavoritesConfig } from "./types";

export const favoritesWidget: WidgetDefinition<FavoritesConfig> = {
  type: "favorites",
  displayName: "즐겨찾기",
  icon: Star,
  category: "core",
  defaultConfig: DEFAULT_FAVORITES_CONFIG,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 16, h: 12 },
  CompactView: FavoritesCompactView,
  ExpandedView: FavoritesExpandedView,
  ConfigEditor: FavoritesConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default favoritesWidget;
export type { FavoritesConfig } from "./types";
