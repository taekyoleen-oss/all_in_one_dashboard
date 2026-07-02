/**
 * ============================================================================
 *  GET /api/stocks?symbols=a,b,c — snapshot quotes (설계서 §2.1, §6.5)
 * ============================================================================
 *
 *  Returns a one-shot batch of normalized quotes for the requested symbols, via
 *  the active provider (KIS when configured, else the keyless fallback poller).
 *  This is BOTH the widget's poll fallback (when SSE is unavailable) and a plain
 *  snapshot endpoint. The response is validated against StockSnapshotSchema from
 *  output/api-shapes.ts (the anti-drift single source) before it leaves.
 *
 *  Carries QUOTES ONLY — never any KIS credential. Read-only market data.
 *
 *  Route Handler (Next.js 16). Always dynamic (reads request URL); not cached.
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/requireUser";
import { getProvider } from "@/lib/api/stock/provider";
import { parseSymbolsParam } from "@/lib/api/stock/symbols-param";
import {
  StockSnapshotSchema,
  type StockSnapshot,
} from "@/output/api-shapes";

/** Never prerender — every response depends on the request + live data. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 인증 게이트 — 익명 호출로 KIS 시세 쿼터 소모 방지.
  const gate = await requireUser();
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const symbols = parseSymbolsParam(searchParams.get("symbols"));

  if (symbols.length === 0) {
    const empty: StockSnapshot = {
      quotes: [],
      errors: [],
      provider: "fallback",
      stale: true,
      ts: Date.now(),
    };
    return Response.json(empty);
  }

  const provider = await getProvider();
  const { quotes, errors } = await provider.getQuotes(symbols);

  const snapshot: StockSnapshot = {
    quotes,
    errors,
    provider: provider.id,
    stale: provider.stale,
    ts: Date.now(),
  };

  // Validate our own output against the shared schema (catches accidental drift).
  const parsed = StockSnapshotSchema.safeParse(snapshot);
  const body: StockSnapshot = parsed.success ? parsed.data : snapshot;

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
