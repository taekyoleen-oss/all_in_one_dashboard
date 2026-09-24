/**
 * /api/widget/fx — 폰 '환율' 위젯의 원화 환산 시세(Bearer 디바이스 토큰).
 *
 *  **읽기 전용**이다. 웹 '환율' 위젯 하나를 골라 그 위젯의 통화 목록을 그대로
 *  조회한다(대상 선택 규칙은 주식과 동일 — widgetMobileTarget.ts).
 *
 *  폰이 계산하지 않도록 **원화 기준 값까지 서버가 만들어** 보낸다. 환산·전일대비
 *  부호 뒤집기는 웹 위젯과 같은 `fxRows`를 쓴다 — 두 곳에서 따로 계산하면 폰과
 *  웹의 숫자가 갈라진다(components/widgets/fx/rows.ts 머리말).
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { sha256Hex } from "@/lib/api/widgetCore";
import { resolveMobileTarget } from "@/lib/api/widgetMobileTarget";
import { fetchRates } from "@/lib/api/fxClient";
import { fxRows } from "@/components/widgets/fx/rows";
import { foreignCurrencies, type FxConfig } from "@/components/widgets/fx/types";
import type { WidgetFx, WidgetFxItem } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

/** 한 위젯이 담을 수 있는 최대 통화 수. */
const MAX_CODES = 12;

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  let target;
  try {
    target = await resolveMobileTarget<FxConfig>(createAdminClient(), device.userId, "fx");
  } catch {
    return Response.json(
      { error: "upstream", message: "환율 위젯 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  // 원화 기준으로 보여 주므로 KRW를 뺀 외화 목록이 조회 대상(웹 훅과 같은 규칙).
  const codes = target
    ? foreignCurrencies({
        base: target.config?.base ?? "KRW",
        quotes: Array.isArray(target.config?.quotes) ? target.config.quotes : [],
      }).slice(0, MAX_CODES)
    : [];

  let items: WidgetFxItem[] = [];
  let date: string | null = null;
  let stale = true;

  if (codes.length > 0) {
    // base=KRW로 받아 rates[C] = 1원당 C → fxRows가 원화 값으로 뒤집는다.
    const rates = await fetchRates("KRW", codes);
    if (rates) {
      date = rates.date ?? null;
      stale = rates.stale;
      items = fxRows(codes, rates.rates, rates.changePct).map((r) => {
        const item: WidgetFxItem = { code: r.code, unit: r.unit, krw: r.krw };
        if (r.changePct !== undefined) item.changePct = r.changePct;
        return item;
      });
    }
  }

  const body: WidgetFx = {
    instanceId: target?.id ?? null,
    items,
    date,
    stale,
    ts: Date.now(),
  };
  const etag = `"${sha256Hex(JSON.stringify({ ...body, ts: 0 })).slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...NO_STORE } });
  }
  return Response.json(body, { headers: { etag, ...NO_STORE } });
}
