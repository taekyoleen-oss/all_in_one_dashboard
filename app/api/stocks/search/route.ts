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
 *  번역·Yahoo 호출·필터는 폰 검색(/api/widget/stocks/search)과 **공유**한다
 *  (lib/api/stock/search.ts) — 두 벌로 갈라지면 결과가 서로 달라진다.
 *
 *  Route Handler (Next.js 16). Always dynamic (reads request URL); not cached.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { searchUsSymbols } from "@/lib/api/stock/search";
import { StockSearchSchema, type StockSearch } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

/** 화면에 노출할 최대 건수(위젯 목록이 길어지지 않게). */
const MAX_RESULTS = 8;

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 외부 API를 대신 두드리지 않게.
  const gate = await requireUser();
  if (gate) return gate;

  // 국내는 브라우저 안 카탈로그가 담당하므로 이 라우트는 미국분만 찾는다.
  // 번역·Yahoo 호출·필터는 폰 라우트와 공유한다(lib/api/stock/search.ts).
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const body: StockSearch = { results: await searchUsSymbols(q, MAX_RESULTS) };
  const parsed = StockSearchSchema.safeParse(body);
  return Response.json(parsed.success ? parsed.data : { results: [] }, {
    headers: { "cache-control": "no-store" },
  });
}
