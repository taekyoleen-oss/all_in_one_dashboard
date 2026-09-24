/**
 * /api/widget/stocks — 폰 '주식' 위젯의 시세(Bearer 디바이스 토큰).
 *
 *  **읽기 전용**이다. 웹 '주식' 위젯 하나를 골라 그 위젯의 종목 목록(config.symbols)을
 *  그대로 조회해 돌려준다 — 폰에서 종목을 더하거나 빼지 않는다(그건 웹에서 한다).
 *  대상은 속성의 '모바일 홈 화면에 표시'를 켠 인스턴스, 지정이 없고 주식 위젯이
 *  하나뿐이면 그것(lib/api/widgetMobileTarget.ts).
 *
 *  시세 경로는 웹(/api/stocks)과 **같은 provider**를 쓴다 — KIS 키가 있으면 KIS,
 *  없으면 키리스 폴백. 따라서 국내 시간외 단일가·미국 프리/애프터도 그대로 반영되고,
 *  그 경우 `session`("pre"|"post")이 붙어 폰이 배지로 표시한다(요구).
 *
 *  ETag/304 지원(15분 폴링 비용 절감 — 아젠다·작업·노트와 같은 리듬).
 *  ⚠ 시세는 개인 본인 용도(재배포 금지) — 이 라우트는 본인 디바이스 토큰에만 응답한다.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { sha256Hex } from "@/lib/api/widgetCore";
import { resolveMobileTarget } from "@/lib/api/widgetMobileTarget";
import { getProvider } from "@/lib/api/stock/provider";
import type { StockSymbol, WidgetStockQuote, WidgetStocks } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** 한 위젯이 담을 수 있는 최대 종목 수 — 폰 화면·업스트림 호출 모두의 상한. */
const MAX_SYMBOLS = 30;

/** config.symbols에서 문자열만 추려 상한을 건다(깨진 config가 업스트림을 때리지 않게). */
function symbolsOf(config: unknown): StockSymbol[] {
  const raw = (config as { symbols?: unknown } | null)?.symbols;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, MAX_SYMBOLS);
}

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let target;
  try {
    target = await resolveMobileTarget<unknown>(createAdminClient(), device.userId, "stock");
  } catch {
    return Response.json(
      { error: "upstream", message: "주식 위젯 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const symbols = target ? symbolsOf(target.config) : [];
  let items: WidgetStockQuote[] = [];
  let stale = true;

  if (symbols.length > 0) {
    const provider = await getProvider();
    stale = provider.stale;
    const { quotes } = await provider.getQuotes(symbols);
    // 위젯에 저장된 순서를 그대로 지킨다(provider는 순서를 보장하지 않는다).
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    items = symbols.flatMap((symbol) => {
      const q = bySymbol.get(symbol);
      if (!q) return []; // 조회 실패 종목은 조용히 빠진다(한 종목이 전체를 망치지 않게)
      const item: WidgetStockQuote = {
        symbol: q.symbol,
        name: q.name,
        price: q.price,
        change: q.change,
        changePct: q.changePct,
        currency: q.currency ?? "KRW",
        isIndex: q.isIndex ?? false,
      };
      if (q.session) item.session = q.session;
      return [item];
    });
  }

  const body: WidgetStocks = {
    instanceId: target?.id ?? null,
    items,
    stale,
    ts: Date.now(),
  };
  // ts는 매번 바뀌므로 ETag 계산에서 뺀다 — 값이 그대로면 폰이 304로 넘어가게.
  const etag = `"${sha256Hex(JSON.stringify({ ...body, ts: 0 })).slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...NO_STORE } });
  }
  return Response.json(body, { headers: { etag, ...NO_STORE } });
}
