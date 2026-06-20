/**
 * stock widget — config shape (설계서 §2.1 "주식 뷰어").
 *
 *  The widget stores a list of provider-neutral symbols (indices toggled on/off
 *  + 국내 개별 종목 added/removed). Quote DATA never lives in config — only the
 *  selection does; live values arrive from /api/stocks(/stream). dataMode:'stream'.
 *
 *  Default = 코스피·코스닥 + 다우·S&P·나스닥 지수 (미국은 지수만). Individual
 *  Korean tickers are added by the user in the ConfigEditor.
 */

import { INDEX_CATALOG } from "@/lib/api/stock/symbols";

export interface StockConfig {
  /** Provider-neutral symbols to display, in order (indices + KR stocks). */
  symbols: string[];
}

/** Default config: the five curated indices (코스피·코스닥·다우·S&P·나스닥). */
export const DEFAULT_STOCK_CONFIG: StockConfig = {
  symbols: INDEX_CATALOG.map((m) => m.symbol),
};
