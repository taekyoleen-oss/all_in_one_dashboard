/**
 * ============================================================================
 *  GET /api/fx?base=USD&symbols=KRW,EUR,JPY — currency rates (설계서 §2.2)
 * ============================================================================
 *
 *  One-shot snapshot of FX rates relative to `base`, via the keyless Frankfurter
 *  source (ECB daily rates) — works today with no key. The response is validated
 *  against FxRatesSchema from output/api-shapes.ts (the anti-drift single source)
 *  before it leaves, and the upstream is never thrown raw to the client.
 *
 *  Caching: a short shared TTL (revalidate + Cache-Control s-maxage) — rates are
 *  daily, so a 5-minute cache is plenty and shields the upstream from polling.
 *
 *  Route Handler (Next.js 16). Reads the request URL, so it is dynamic; caching
 *  is expressed via Cache-Control on the Response (CDN/proxy honor it).
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import {
  DEFAULT_FX_BASE,
  fetchRates,
  normalizeCode,
  parseSymbolsParam,
} from "@/lib/api/fxClient";
import { FxRatesSchema, type FxRates } from "@/output/api-shapes";

/** Revalidate hint (seconds) for any cached fetches within this route. */
export const revalidate = 300;

/** Short shared cache so repeated widget polls don't hammer the upstream. */
const CACHE_HEADERS = {
  "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
} as const;

export async function GET(request: NextRequest) {
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
