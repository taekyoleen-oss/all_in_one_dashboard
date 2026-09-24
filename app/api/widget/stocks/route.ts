/**
 * /api/widget/stocks — 폰 '주식' 위젯의 시세(Bearer 디바이스 토큰).
 *
 *  **읽기 전용**이다. 웹 '주식' 위젯 하나를 골라 그 위젯의 종목 목록(config.symbols)을
 *  그대로 조회해 돌려준다. 폰에서도 종목을 **추가·삭제**할 수 있다(요구) — 다만
 *  고르는 방식이 다르다: 웹은 카탈로그 검색 UI, 폰은 /api/widget/stocks/search.
 *  대상은 속성의 '모바일 홈 화면에 표시'를 켠 인스턴스, 지정이 없고 주식 위젯이
 *  하나뿐이면 그것(lib/api/widgetMobileTarget.ts).
 *
 *  시세 경로는 웹(/api/stocks)과 **같은 provider**를 쓴다 — KIS 키가 있으면 KIS,
 *  없으면 키리스 폴백. 따라서 국내 시간외 단일가·미국 프리/애프터도 그대로 반영되고,
 *  그 경우 `session`("pre"|"post")이 붙어 폰이 배지로 표시한다(요구).
 *
 *  GET  : 그 위젯의 종목 시세(웹에 저장된 순서 그대로).
 *  POST : { symbol } → 그 위젯에 종목 추가(요구: 폰에서도 추가). 시세가 실제로
 *         나오는 심볼인지 확인한 뒤에만 넣는다.
 *  DELETE ?symbol= : 그 위젯에서 종목 제거(요구: 폰에서도 삭제).
 *
 *  ⚠ 폰은 **config 전체를 쓰지 않는다** — 서버가 현재 config에 `symbols`만 갈아
 *    끼운다(색·크기 등 웹에서만 쓰는 설정이 폰 때문에 사라지지 않게).
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
import type { Json } from "@/output/types/database";
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

/* ── 추가·삭제(요구: 폰에서도 종목 관리) ─────────────────────────────────── */

/** 지정이 없을 때 폰에 그대로 보여 줄 안내. */
const NO_TARGET =
  "웹 대시보드의 '주식' 위젯 속성에서 '모바일 홈 화면에 표시'를 먼저 켜 주세요.";

/** 대문자 표기는 미국 티커에만 적용한다(국내 코드는 숫자, 지수는 ^로 시작). */
function canonical(raw: string): string {
  const sym = raw.trim();
  return /^[A-Za-z]/.test(sym) ? sym.toUpperCase() : sym;
}

/** 현재 config에 symbols만 갈아끼워 저장 — 나머지 설정은 그대로 둔다. */
async function saveSymbols(
  admin: ReturnType<typeof createAdminClient>,
  target: { id: string; config: unknown },
  userId: string,
  symbols: string[],
): Promise<boolean> {
  const config = { ...((target.config ?? {}) as Record<string, Json>), symbols };
  const { error } = await admin
    .from("pb_widgets")
    .update({ config: config as Json })
    .eq("id", target.id)
    .eq("user_id", userId);
  return !error;
}

/** 대상 위젯 + admin 클라이언트 — 조회 실패는 '미지정'과 같게 다룬다. */
async function target(userId: string) {
  const admin = createAdminClient();
  try {
    return { admin, found: await resolveMobileTarget<unknown>(admin, userId, "stock") };
  } catch {
    return { admin, found: null };
  }
}

export async function POST(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "요청 형식이 올바르지 않습니다." },
      { status: 400, headers: NO_STORE },
    );
  }
  const symbol = canonical(String((raw as { symbol?: unknown })?.symbol ?? ""));
  if (!symbol) {
    return Response.json(
      { error: "bad_request", message: "종목을 선택해 주세요." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin, found } = await target(device.userId);
  if (!found) {
    return Response.json({ error: "no_target", message: NO_TARGET }, { status: 409, headers: NO_STORE });
  }

  const symbols = symbolsOf(found.config);
  if (symbols.includes(symbol)) {
    return Response.json(
      { error: "duplicate", message: "이미 추가된 종목입니다." },
      { status: 409, headers: NO_STORE },
    );
  }
  if (symbols.length >= MAX_SYMBOLS) {
    return Response.json(
      { error: "full", message: `종목은 최대 ${MAX_SYMBOLS}개까지 담을 수 있습니다.` },
      { status: 409, headers: NO_STORE },
    );
  }

  // 시세가 실제로 나오는 심볼만 넣는다 — 오타가 config에 남아 위젯에서 영영
  // "—"로 보이는 일을 막는다(폰에는 지우기 전까지 이유가 안 보인다).
  const provider = await getProvider();
  const { quotes } = await provider.getQuotes([symbol]);
  const quote = quotes.find((q) => q.symbol === symbol);
  if (!quote) {
    return Response.json(
      { error: "unknown_symbol", message: "시세를 찾을 수 없는 종목입니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!(await saveSymbols(admin, found, device.userId, [...symbols, symbol]))) {
    return Response.json(
      { error: "upstream", message: "추가에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json({ symbol, name: quote.name }, { status: 201, headers: NO_STORE });
}

export async function DELETE(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const symbol = canonical(new URL(request.url).searchParams.get("symbol") ?? "");
  if (!symbol) {
    return Response.json(
      { error: "bad_request", message: "종목이 지정되지 않았습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin, found } = await target(device.userId);
  if (!found) {
    return Response.json({ error: "no_target", message: NO_TARGET }, { status: 409, headers: NO_STORE });
  }

  const symbols = symbolsOf(found.config);
  const next = symbols.filter((s) => s !== symbol);
  if (next.length === symbols.length) {
    return Response.json(
      { error: "not_found", message: "이미 삭제된 종목입니다." },
      { status: 404, headers: NO_STORE },
    );
  }
  if (!(await saveSymbols(admin, found, device.userId, next))) {
    return Response.json(
      { error: "upstream", message: "삭제에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json({ symbol }, { headers: NO_STORE });
}
