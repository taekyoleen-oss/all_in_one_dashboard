/**
 * ============================================================================
 *  GET /api/translate?q=&source=&target= — one translation (번역기)
 * ============================================================================
 *
 *  On-demand (not poll) translation. Keyless by default (Google gtx → MyMemory),
 *  upgrades to DeepL when DEEPL_API_KEY is set. `source` may be "auto". Validated
 *  against TranslateSchema (output/api-shapes.ts — the anti-drift single source)
 *  before it leaves; the upstream is never thrown raw and the key never reaches
 *  the client.
 *
 *  Route Handler (Next.js 16). Reads the request URL → dynamic; not cached
 *  (translations are per-request and cheap to re-run).
 * ============================================================================
 */

import type { NextRequest } from "next/server";
import { translate, MAX_TRANSLATE_CHARS } from "@/lib/api/translateClient";
import { TranslateSchema, type Translate } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").slice(0, MAX_TRANSLATE_CHARS);
  const source = (searchParams.get("source") ?? "auto").trim() || "auto";
  const target = (searchParams.get("target") ?? "en").trim() || "en";

  if (!q.trim()) {
    return Response.json(
      { error: "empty_query", message: "번역할 내용을 입력하세요." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const result = await translate(q, source, target);

  if (!result) {
    return Response.json(
      { error: "translate_unavailable", message: "번역에 실패했습니다. 잠시 후 다시 시도하세요." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }

  const parsed = TranslateSchema.safeParse(result);
  const body: Translate = parsed.success ? parsed.data : result;

  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
