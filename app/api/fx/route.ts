/**
 * ============================================================================
 *  GET /api/fx?base=USD&symbols=KRW,EUR,JPY — currency rates (설계서 §2.2)
 * ============================================================================
 *
 *  One-shot snapshot of FX rates relative to `base`. KRW 기준 요청은 네이버 고시환율
 *  (준실시간), 실패 시 keyless Frankfurter(ECB 일별)로 강등 — 둘 다 키 불필요.
 *  The response is validated against FxRatesSchema from output/api-shapes.ts (the
 *  anti-drift single source) before it leaves; the upstream is never thrown raw.
 *
 *  Caching: a short shared TTL (revalidate + Cache-Control s-maxage) aligned to
 *  the widget's 3-minute poll — fresh enough for 고시회차 갱신, still shields the
 *  upstream from bursts.
 *
 *  Route Handler (Next.js 16). Reads the request URL, so it is dynamic; caching
 *  is expressed via Cache-Control on the Response (CDN/proxy honor it).
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import {
  DEFAULT_FX_BASE,
  fetchRates,
  normalizeCode,
  parseSymbolsParam,
} from "@/lib/api/fxClient";
import { FxRatesSchema, type FxRates } from "@/output/api-shapes";

/** Revalidate hint (seconds) — aligned to the widget's 3-minute poll cadence. */
export const revalidate = 180;

/** Short shared cache so repeated widget polls don't hammer the upstream. */
const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=180, stale-while-revalidate=360",
} as const;

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 upstream 소모 방지.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const base = normalizeCode(searchParams.get("base") ?? "") ?? DEFAULT_FX_BASE;
  const symbols = parseSymbolsParam(searchParams.get("symbols"));

  const rates = await fetchRates(base, symbols);

  if (!rates) {
    // Typed error envelope — never a raw upstream error.
    return Response.json(
      { error: "fx_unavailable", message: "환율 정보를 불러오지 못했습니다." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  // Validate our own output against the shared schema (catches accidental drift).
  const parsed = FxRatesSchema.safeParse(rates);
  const body: FxRates = parsed.success ? parsed.data : rates;

  return Response.json(body, { headers: CACHE_HEADERS });
}
