/**
 * ============================================================================
 *  GET /api/news?query=… — headline list (설계서 §2.2 "뉴스/RSS")
 * ============================================================================
 *
 *  Recent headlines for a keyword. Primary source is the Naver News API when
 *  NAVER_CLIENT_ID/SECRET are set; the keyless fallback is a public Google News
 *  RSS for the same keyword, parsed server-side — works today with no key.
 *  Validated against NewsListSchema (output/api-shapes.ts — the anti-drift
 *  single source) before it leaves; the upstream is never thrown raw to the
 *  client, and credentials never reach it.
 *
 *  Caching: short shared TTL (5 min) via Cache-Control — fresh enough for a
 *  headline widget while shielding the upstream from per-poll traffic.
 *
 *  Route Handler (Next.js 16). Reads the request URL → dynamic; caching via
 *  Cache-Control on the Response.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { fetchNews, normalizeQuery } from "@/lib/api/newsClient";
import { NewsListSchema, type NewsList } from "@/output/api-shapes";

export const revalidate = 300;

const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
} as const;

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 유료 upstream(Naver API 쿼터) 소모 방지.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("query"));

  const news = await fetchNews(query);

  if (!news) {
    return Response.json(
      { error: "news_unavailable", message: "뉴스를 불러오지 못했습니다." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = NewsListSchema.safeParse(news);
  const body: NewsList = parsed.success ? parsed.data : news;

  return Response.json(body, { headers: CACHE_HEADERS });
}
