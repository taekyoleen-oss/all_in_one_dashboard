/**
 * ============================================================================
 *  Stock symbol catalog — provider-neutral ticker metadata (설계서 §2.1)
 * ============================================================================
 *
 *  Maps the provider-neutral symbols stored in widget config to display names,
 *  index-vs-stock classification, and currency. Both providers (KIS + fallback)
 *  read this so a name like "코스피" is consistent regardless of source.
 *
 *  Symbol convention (what the widget stores in config):
 *    • KR indices   : "^KS11" (코스피), "^KQ11" (코스닥)
 *    • US indices   : "^DJI" (다우), "^GSPC" (S&P 500), "^IXIC" (나스닥)
 *    • KR stocks    : 6-digit code, optionally ".KS"/".KQ" suffix ("005930" / "005930.KS")
 *    • US stocks/ETF: Yahoo 티커 그대로 ("AAPL", "SPY", "QQQ", "BRK-B") — 카탈로그가
 *      없으므로 사용자가 직접 입력하고, 시세는 키리스 Yahoo 폴백이 조회한다.
 * ============================================================================
 */

import type { StockSearchResult, StockSymbol } from "@/output/api-shapes";
// 확장자 명시: node --test(타입 스트리핑)의 ESM 해석이 확장자 없는 상대경로를 못 찾는다
// (symbols.test.ts가 이 모듈을 직접 로드). 번들러(Next)는 실제 파일명 그대로 해석한다.
import { KRX_STOCKS } from "./krx-catalog.generated.ts";

export interface SymbolMeta {
  /** Provider-neutral symbol (catalog key). */
  symbol: StockSymbol;
  /** Default Korean display name. */
  name: string;
  /** Index vs individual stock. */
  isIndex: boolean;
  /** ISO-4217 currency of the quote. */
  currency: "KRW" | "USD";
}

/** Curated indices — the default config uses 코스피·코스닥 + 다우·S&P·나스닥. */
export const INDEX_CATALOG: SymbolMeta[] = [
  { symbol: "^KS11", name: "코스피", isIndex: true, currency: "KRW" },
  { symbol: "^KQ11", name: "코스닥", isIndex: true, currency: "KRW" },
  { symbol: "^DJI", name: "다우", isIndex: true, currency: "USD" },
  { symbol: "^GSPC", name: "S&P 500", isIndex: true, currency: "USD" },
  { symbol: "^IXIC", name: "나스닥", isIndex: true, currency: "USD" },
];

/** Helper: a KRW individual-stock catalog entry. KOSDAQ symbols carry ".KQ" so
 *  the Yahoo fallback resolves the right exchange (toYahooSymbol defaults bare
 *  codes to ".KS"); KOSPI entries use the bare 6-digit code. */
function krStock(symbol: string, name: string): SymbolMeta {
  return { symbol, name, isIndex: false, currency: "KRW" };
}

/**
 * Curated popular 국내 종목 — shown as quick picks when the search box is EMPTY
 * (the full catalog below is alphabetical, which makes poor suggestions). Search
 * itself runs over the complete KRX catalog, so every listed stock is findable.
 */
const POPULAR_KR_STOCKS: SymbolMeta[] = [
  // KOSPI
  krStock("005930", "삼성전자"),
  krStock("000660", "SK하이닉스"),
  krStock("373220", "LG에너지솔루션"),
  krStock("207940", "삼성바이오로직스"),
  krStock("005380", "현대차"),
  krStock("000270", "기아"),
  krStock("005490", "POSCO홀딩스"),
  krStock("035420", "NAVER"),
  krStock("035720", "카카오"),
  krStock("051910", "LG화학"),
  krStock("006400", "삼성SDI"),
  krStock("028260", "삼성물산"),
  krStock("105560", "KB금융"),
  krStock("055550", "신한지주"),
  krStock("086790", "하나금융지주"),
  krStock("316140", "우리금융지주"),
  krStock("024110", "기업은행"),
  krStock("012330", "현대모비스"),
  krStock("068270", "셀트리온"),
  krStock("034730", "SK"),
  krStock("003550", "LG"),
  krStock("066570", "LG전자"),
  krStock("009150", "삼성전기"),
  krStock("018260", "삼성에스디에스"),
  krStock("032830", "삼성생명"),
  krStock("000810", "삼성화재"),
  krStock("015760", "한국전력"),
  krStock("017670", "SK텔레콤"),
  krStock("030200", "KT"),
  krStock("033780", "KT&G"),
  krStock("010130", "고려아연"),
  krStock("051900", "LG생활건강"),
  krStock("090430", "아모레퍼시픽"),
  krStock("097950", "CJ제일제당"),
  krStock("010950", "S-Oil"),
  krStock("096770", "SK이노베이션"),
  krStock("003670", "포스코퓨처엠"),
  krStock("011200", "HMM"),
  krStock("042700", "한미반도체"),
  krStock("012450", "한화에어로스페이스"),
  krStock("009540", "HD한국조선해양"),
  krStock("010140", "삼성중공업"),
  krStock("047810", "한국항공우주"),
  krStock("086280", "현대글로비스"),
  krStock("000720", "현대건설"),
  krStock("251270", "넷마블"),
  krStock("036570", "엔씨소프트"),
  krStock("259960", "크래프톤"),
  krStock("352820", "하이브"),
  krStock("323410", "카카오뱅크"),
  // KOSDAQ (.KQ)
  krStock("247540.KQ", "에코프로비엠"),
  krStock("086520.KQ", "에코프로"),
  krStock("196170.KQ", "알테오젠"),
  krStock("028300.KQ", "HLB"),
  krStock("293490.KQ", "카카오게임즈"),
  krStock("263750.KQ", "펄어비스"),
  krStock("112040.KQ", "위메이드"),
  krStock("058470.KQ", "리노공업"),
  krStock("068760.KQ", "셀트리온제약"),
  krStock("041510.KQ", "에스엠"),
  krStock("035900.KQ", "JYP Ent."),
  krStock("122870.KQ", "와이지엔터테인먼트"),
];

/**
 * The COMPLETE searchable catalog: every KOSPI + KOSDAQ listing (생성: KRX KIND,
 * lib/api/stock/krx-catalog.generated.ts). This is what makes 모든 종목 검색 가능.
 * Popular curated names override the generated label where they differ (nicer
 * display), but every symbol present in either list is included exactly once.
 */
export const KR_STOCK_CATALOG: SymbolMeta[] = (() => {
  const popularNames = new Map(POPULAR_KR_STOCKS.map((m) => [m.symbol, m.name]));
  return KRX_STOCKS.map(([symbol, name]) => ({
    symbol,
    name: popularNames.get(symbol) ?? name,
    isIndex: false as const,
    currency: "KRW" as const,
  }));
})();

/** A few well-known KR stocks shown as quick picks when the search box is empty. */
export const KR_STOCK_SUGGESTIONS: SymbolMeta[] = POPULAR_KR_STOCKS.slice(0, 8);

const BY_SYMBOL = new Map<string, SymbolMeta>(
  [...INDEX_CATALOG, ...KR_STOCK_CATALOG].map((m) => [m.symbol, m]),
);

/**
 * Search the FULL KR stock catalog by 회사명(부분 일치, 대소문자 무시) OR 코드(접두
 * 일치). Empty query returns popular quick-picks. Used by the stock ConfigEditor's
 * search box so the user can type "삼성", "에코프로", "0059…" and pick any listed stock.
 */
export function searchKrStocks(query: string, limit = 30): SymbolMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return KR_STOCK_SUGGESTIONS.slice(0, limit);
  const digits = q.replace(/\D/g, "");
  const out: SymbolMeta[] = [];
  for (const m of KR_STOCK_CATALOG) {
    const nameHit = m.name.toLowerCase().includes(q);
    const codeHit =
      digits.length > 0 && (krCode(m.symbol) ?? "").startsWith(digits);
    if (nameHit || codeHit) {
      out.push(m);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Strip a ".KS"/".KQ" suffix and return the bare 6-digit code (else null). */
export function krCode(symbol: string): string | null {
  const m = symbol.match(/^(\d{6})(?:\.[A-Za-z]{2})?$/);
  return m ? m[1] : null;
}

/** True for a KR index symbol ("^KS11"/"^KQ11"). */
export function isKrIndex(symbol: string): boolean {
  return symbol === "^KS11" || symbol === "^KQ11";
}

/** True for a US index symbol ("^DJI"/"^GSPC"/"^IXIC"). */
export function isUsIndex(symbol: string): boolean {
  return symbol === "^DJI" || symbol === "^GSPC" || symbol === "^IXIC";
}

/** True for any caret-prefixed index symbol. */
export function isIndexSymbol(symbol: string): boolean {
  return symbol.startsWith("^");
}

/**
 * 미국 개별 종목·ETF 티커인지 — Yahoo 심볼 문법(영문으로 시작 + 영숫자/./-).
 * 국내 코드는 숫자로, 지수는 "^"로 시작하므로 겹치지 않는다. 예: AAPL, SPY, BRK-B.
 */
export function isUsTicker(symbol: string): boolean {
  return /^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(symbol);
}

/**
 * KIS 국내 시세 API로 조회 가능한 심볼(코스피/코스닥 지수 또는 6자리 종목코드).
 * 나머지(해외 지수·미국 종목/ETF)는 Yahoo 폴백이 처리한다 — kisClient 라우팅 기준.
 */
export function isDomesticSymbol(symbol: string): boolean {
  return isKrIndex(symbol) || krCode(symbol) !== null;
}

/** Yahoo 심볼 검색 응답 1건에서 우리가 읽는 최소 필드. */
export interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
}

/**
 * Yahoo 심볼 검색 결과 → 위젯이 추가할 수 있는 미국 주식·ETF 목록
 * (/api/stocks/search가 사용. 순수 함수라 테스트 대상).
 *
 *  걸러내는 것(실제 응답 실측 기준):
 *   • quoteType이 EQUITY·ETF가 아닌 것 — OPTION("SCHD260918C00034000")·MUTUALFUND 등.
 *   • 접미사(.)가 붙은 심볼 — "AAPL.BA"·"APC.DE"·"1655.T" 같은 해외 중복상장.
 *     우리 시세 경로(Yahoo chart)는 접미사 없는 미국 상장만 안정적으로 다룬다.
 */
export function mapUsSearchResults(
  quotes: YahooSearchQuote[] | undefined,
  limit = 8,
): StockSearchResult[] {
  const out: StockSearchResult[] = [];
  for (const q of quotes ?? []) {
    const symbol = q.symbol?.trim();
    const type = q.quoteType;
    if (!symbol || symbol.includes(".")) continue;
    if (type !== "EQUITY" && type !== "ETF") continue;
    out.push({
      symbol,
      // longname 우선 — Yahoo shortname은 31자에서 잘린 채로 오기도 한다("… Total Stoc").
      // 목록은 CSS truncate라 긴 이름이 와도 말줄임으로 자연스럽게 처리된다.
      name: (q.longname ?? q.shortname ?? symbol).trim(),
      exchange: q.exchange?.trim() ?? "",
      type,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Best-effort metadata for a symbol: the curated entry when known, otherwise a
 * reasonable default (KR 6-digit ⇒ KRW stock; caret ⇒ index; else KRW stock).
 * The `name` falls back to the symbol so the UI always has a label.
 */
export function resolveMeta(symbol: string): SymbolMeta {
  const hit = BY_SYMBOL.get(symbol);
  if (hit) return hit;

  if (isIndexSymbol(symbol)) {
    return {
      symbol,
      name: symbol.replace(/^\^/, ""),
      isIndex: true,
      currency: isUsIndex(symbol) ? "USD" : "KRW",
    };
  }
  const code = krCode(symbol);
  if (code) {
    return { symbol, name: code, isIndex: false, currency: "KRW" };
  }
  // 미국 종목·ETF: 카탈로그가 없으므로 티커를 그대로 이름으로 쓴다(통화는 응답값 우선).
  if (isUsTicker(symbol)) {
    return { symbol, name: symbol.toUpperCase(), isIndex: false, currency: "USD" };
  }
  // Unknown free-form symbol — assume a KR stock so quotes still attempt to resolve.
  return { symbol, name: symbol, isIndex: false, currency: "KRW" };
}

/**
 * The Yahoo Finance chart symbol for a provider-neutral symbol.
 *  - indices map 1:1 (Yahoo uses the same caret symbols).
 *  - a bare 6-digit KR code needs an exchange suffix; default ".KS" (KOSPI). A
 *    KOSDAQ name may be entered explicitly as "035720.KQ".
 */
export function toYahooSymbol(symbol: string): string {
  if (isIndexSymbol(symbol)) return symbol;
  const code = krCode(symbol);
  if (code) {
    // Preserve an explicit .KQ; otherwise default to .KS.
    return symbol.includes(".") ? symbol : `${code}.KS`;
  }
  return symbol;
}
