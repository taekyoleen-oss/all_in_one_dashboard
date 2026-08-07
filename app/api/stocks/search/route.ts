/**
 * ============================================================================
 *  GET /api/stocks/search?q=… — 미국 종목·ETF 이름 검색 (설계서 §2.1)
 * ============================================================================
 *
 *  국내 종목은 위젯이 번들된 KRX 카탈로그로 즉시 검색하지만, 미국은 카탈로그가
 *  없어 티커를 외워야 했다(사용자 요청: 이름으로 검색). Yahoo의 키리스 심볼 검색을
 *  서버에서 프록시한다 — 브라우저 직접 호출은 CORS로 막히고, 인증 게이트로 익명
 *  호출도 막는다. 시세가 아니라 '심볼 찾기'용이라 캐시 없이 그때그때 조회.
 *
 *  한글 질의(사용자 요청)는 Yahoo가 400을 주므로 ko→en 번역을 한 단계 앞에 둔다.
 *
 *  응답은 output/api-shapes.ts의 StockSearchSchema(단일 소스)를 따른다.
 *  업스트림 호출이 이 파일 하나에서만 쓰여 별도 client 모듈을 두지 않는다.
 *
 *  Route Handler (Next.js 16). Always dynamic (reads request URL); not cached.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import {
  mapUsSearchResults,
  type YahooSearchQuote,
} from "@/lib/api/stock/symbols";
import { translate } from "@/lib/api/translateClient";
import { StockSearchSchema, type StockSearch } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const FETCH_TIMEOUT_MS = 6_000;
/** 화면에 노출할 최대 건수(위젯 목록이 길어지지 않게). */
const MAX_RESULTS = 8;

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 외부 API를 대신 두드리지 않게.
  const gate = await requireUser();
  if (gate) return gate;

  const raw = (new URL(request.url).searchParams.get("q") ?? "").trim();
  const empty: StockSearch = { results: [] };
  if (!raw) {
    return Response.json(empty, { headers: { "cache-control": "no-store" } });
  }

  // Yahoo 검색은 한글 질의에 400을 준다(lang/region 파라미터로도 안 됨 — 실측).
  // 한글이 있으면 저장소의 번역기(키리스 Google gtx → MyMemory)로 ko→en 변환 후 검색:
  //   "애플"→apple→AAPL, "엔비디아"→nvidia→NVDA, "배당 ETF"→Dividend ETF→HDV·SDY…
  // (네이버 종목 자동완성은 한글명은 정확하지만 '배당 ETF' 같은 주제어를 못 찾아 제외.)
  const q = /[가-힣]/.test(raw)
    ? ((await translate(raw, "ko", "en"))?.translatedText ?? "").trim()
    : raw;
  // 번역 실패·번역 후에도 라틴 문자가 없으면 업스트림을 부르지 않는다(400 방지).
  if (!/[A-Za-z]/.test(q)) {
    return Response.json(empty, { headers: { "cache-control": "no-store" } });
  }

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
    if (!res.ok) return Response.json(empty, { status: 200 });

    const json = (await res.json()) as { quotes?: YahooSearchQuote[] };
    // 필터·정규화는 순수 함수(symbols.mapUsSearchResults)에 있다 — 단위 테스트 대상.
    const body: StockSearch = { results: mapUsSearchResults(json.quotes, MAX_RESULTS) };
    const parsed = StockSearchSchema.safeParse(body);
    return Response.json(parsed.success ? parsed.data : empty, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    // 타임아웃·네트워크 실패는 빈 결과로 — 검색창이 죽지 않게(직접 티커 입력 가능).
    return Response.json(empty, { headers: { "cache-control": "no-store" } });
  } finally {
    clearTimeout(timer);
  }
}
