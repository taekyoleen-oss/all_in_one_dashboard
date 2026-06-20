/**
 * card-usage widget — config shape (설계서 §2.1 #9 "카드 사용현황").
 *
 *  The widget is a READ-ONLY snapshot (dataMode:'static') over the user's own
 *  `pb_card_transactions` + `pb_cards`, read via the browser Supabase client
 *  (RLS-scoped) and aggregated client-side. Transaction DATA never lives in
 *  config — only display preferences do. copyBehavior:'config'. sensitive:true.
 *
 *  Default = show the current month, all cards.
 */

export interface CardUsageConfig {
  /**
   * Optional card filter: when non-empty, only these card ids are summed. Empty
   * → all of the user's cards. Stored as ids so a renamed card still resolves.
   */
  cardIds: string[];
  /** How many recent months to include in the trend chart (3–12). */
  trendMonths: number;
}

export const DEFAULT_CARD_USAGE_CONFIG: CardUsageConfig = {
  cardIds: [],
  trendMonths: 6,
};

/** A readable palette for category chart bars (color + always paired with a label). */
export const CATEGORY_COLORS: string[] = [
  "#0891B2", // cyan-600
  "#7C3AED", // violet-600
  "#DB2777", // pink-600
  "#D97706", // amber-600
  "#059669", // emerald-600
  "#2563EB", // blue-600
  "#DC2626", // red-600
  "#65A30D", // lime-600
  "#9333EA", // purple-600
  "#0D9488", // teal-600
];

/** Pick a stable color for a category index (cycles the palette). */
export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}
