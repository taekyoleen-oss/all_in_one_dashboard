/**
 * /api/widget/stocks/search?q= — 폰 '주식' 위젯의 종목 검색(Bearer 디바이스 토큰).
 *
 *  폰에는 번들 카탈로그가 없으므로 지수·국내·미국을 **서버가 합쳐** 준다
 *  (lib/api/stock/search.ts — 웹 검색과 같은 번역·필터 경로).
 *  결과를 고르면 POST /api/widget/stocks로 그 심볼이 위젯에 추가된다.
 */
import type { NextRequest } from "next/server";
import { requireDevice } from "@/lib/api/widgetDevice";
import { searchAllSymbols } from "@/lib/api/stock/search";
import type { WidgetSymbolSearch } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const body: WidgetSymbolSearch = { results: await searchAllSymbols(q) };
  return Response.json(body, { headers: NO_STORE });
}
