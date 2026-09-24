/**
 * 종목 검색 — 웹(/api/stocks/search)과 폰(/api/widget/stocks/search)이 함께 쓴다.
 *
 *  SERVER-ONLY. 국내는 번들 카탈로그(즉시·오프라인), 미국은 Yahoo 심볼 검색이다.
 *  한글 질의는 Yahoo가 400을 주므로(실측) 저장소의 키리스 번역기로 ko→en 변환 후
 *  부른다 — "애플"→apple→AAPL.
 *
 *  웹은 국내 검색을 브라우저 안 카탈로그로 직접 하므로 미국분(`searchUsSymbols`)만
 *  쓰고, 폰은 카탈로그가 없으니 합본(`searchAllSymbols`)을 받는다.
 */

import {
  INDEX_CATALOG,
  krCode,
  mapUsSearchResults,
  searchKrStocks,
  type SymbolMeta,
  type YahooSearchQuote,
} from "@/lib/api/stock/symbols";
import { translate } from "@/lib/api/translateClient";
import type { StockSearchResult, WidgetSymbolHit } from "@/output/api-shapes";

const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const FETCH_TIMEOUT_MS = 6_000;

/**
 * 미국 주식·ETF 검색. 실패·타임아웃은 **빈 배열**로 — 검색창이 죽는 것보다 낫다
 * (티커 직접 입력 경로가 따로 있다).
 */
export async function searchUsSymbols(
  raw: string,
  limit = 8,
): Promise<StockSearchResult[]> {
  const query = raw.trim();
  if (!query) return [];

  const q = /[가-힣]/.test(query)
    ? ((await translate(query, "ko", "en"))?.translatedText ?? "").trim()
    : query;
  // 번역 실패·번역 후에도 라틴 문자가 없으면 업스트림을 부르지 않는다(400 방지).
  if (!/[A-Za-z]/.test(q)) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${SEARCH_URL}?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0`,
      {
        signal: controller.signal,
        // Yahoo는 기본 Node UA를 간헐적으로 차단한다(fallbackClient와 동일 UA).
        headers: { "User-Agent": "Mozilla/5.0 (PaneBoard quote fallback)" },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { quotes?: YahooSearchQuote[] };
    return mapUsSearchResults(json.quotes, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** 지수는 이름으로만 찾는다(코드가 `^KS11`이라 사용자가 외울 값이 아니다). */
function searchIndices(query: string): SymbolMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return INDEX_CATALOG.filter((m) => m.name.toLowerCase().includes(q));
}

/**
 * 폰용 합본 검색 — 지수 → 국내 종목 → 미국 순(한국 사용자가 찾는 순서).
 * 질의가 비면 빈 목록(폰은 '무엇을 추가할지' 타이핑부터 시작한다).
 */
export async function searchAllSymbols(
  query: string,
  limit = 12,
): Promise<WidgetSymbolHit[]> {
  const q = query.trim();
  if (!q) return [];

  const out: WidgetSymbolHit[] = [];
  const push = (symbol: string, name: string, sub: string) => {
    if (out.length >= limit) return;
    if (out.some((h) => h.symbol === symbol)) return;
    out.push({ symbol, name, sub });
  };

  for (const m of searchIndices(q)) push(m.symbol, m.name, "지수");
  for (const m of searchKrStocks(q, limit)) {
    push(m.symbol, m.name, krCode(m.symbol) ?? m.symbol);
  }
  // 국내에서 충분히 찾았으면 외부 호출을 아낀다(타이핑마다 Yahoo를 두드리지 않게).
  if (out.length < limit) {
    for (const r of await searchUsSymbols(q, limit - out.length)) {
      push(r.symbol, r.name, [r.exchange, r.type === "ETF" ? "ETF" : ""].filter(Boolean).join(" "));
    }
  }
  return out.slice(0, limit);
}
