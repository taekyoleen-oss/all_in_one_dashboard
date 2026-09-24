/**
 * /api/widget/fx — 폰 '환율' 위젯의 원화 환산 시세(Bearer 디바이스 토큰).
 *
 *  웹 '환율' 위젯 하나를 골라 그 위젯의 통화 목록을 그대로 조회한다(대상 선택
 *  규칙은 주식과 동일 — widgetMobileTarget.ts). 폰에서도 통화를 **추가·삭제**할 수
 *  있다(요구).
 *
 *  GET  : 원화 기준 환산 목록.
 *  POST : { code } → 통화 추가(ISO-4217 3자리).
 *  DELETE ?code= : 통화 제거.
 *
 *  ⚠ 폰은 config 전체를 쓰지 않는다 — 서버가 `quotes`만 갈아끼운다.
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
import type { Json } from "@/output/types/database";
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

/* ── 추가·삭제(요구: 폰에서도 통화 관리) ─────────────────────────────────── */

const NO_TARGET =
  "웹 대시보드의 '환율' 위젯 속성에서 '모바일 홈 화면에 표시'를 먼저 켜 주세요.";

const CODE_RE = /^[A-Za-z]{3}$/;

/** 대상 위젯 + admin 클라이언트 — 조회 실패는 '미지정'과 같게 다룬다. */
async function target(userId: string) {
  const admin = createAdminClient();
  try {
    return { admin, found: await resolveMobileTarget<FxConfig>(admin, userId, "fx") };
  } catch {
    return { admin, found: null };
  }
}

/** 현재 config에 quotes만 갈아끼워 저장 — 기준 통화·나머지 설정은 그대로. */
async function saveQuotes(
  admin: ReturnType<typeof createAdminClient>,
  target: { id: string; config: FxConfig },
  userId: string,
  quotes: string[],
): Promise<boolean> {
  const config = { ...((target.config ?? {}) as unknown as Record<string, Json>), quotes };
  const { error } = await admin
    .from("pb_widgets")
    .update({ config: config as Json })
    .eq("id", target.id)
    .eq("user_id", userId);
  return !error;
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
  const code = String((raw as { code?: unknown })?.code ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return Response.json(
      { error: "bad_request", message: "3자리 통화 코드를 입력하세요 (예: USD, EUR)." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (code === "KRW") {
    return Response.json(
      { error: "bad_request", message: "원화는 기준 통화라 추가할 수 없습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin, found } = await target(device.userId);
  if (!found) {
    return Response.json({ error: "no_target", message: NO_TARGET }, { status: 409, headers: NO_STORE });
  }

  const quotes = Array.isArray(found.config?.quotes) ? found.config.quotes : [];
  if (foreignCurrencies({ base: found.config?.base ?? "KRW", quotes }).includes(code)) {
    return Response.json(
      { error: "duplicate", message: "이미 추가된 통화입니다." },
      { status: 409, headers: NO_STORE },
    );
  }
  if (quotes.length >= MAX_CODES) {
    return Response.json(
      { error: "full", message: `통화는 최대 ${MAX_CODES}개까지 담을 수 있습니다.` },
      { status: 409, headers: NO_STORE },
    );
  }

  // 환율이 실제로 나오는 통화만 넣는다(오타가 목록에 남지 않게).
  const probe = await fetchRates("KRW", [code]);
  if (!probe || typeof probe.rates[code] !== "number") {
    return Response.json(
      { error: "unknown_code", message: "환율을 찾을 수 없는 통화입니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!(await saveQuotes(admin, found, device.userId, [...quotes, code]))) {
    return Response.json(
      { error: "upstream", message: "추가에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json({ code }, { status: 201, headers: NO_STORE });
}

export async function DELETE(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const code = (new URL(request.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return Response.json(
      { error: "bad_request", message: "통화가 지정되지 않았습니다." },
      { status: 400, headers: NO_STORE },
    );
  }

  const { admin, found } = await target(device.userId);
  if (!found) {
    return Response.json({ error: "no_target", message: NO_TARGET }, { status: 409, headers: NO_STORE });
  }

  const quotes = Array.isArray(found.config?.quotes) ? found.config.quotes : [];
  const next = quotes.filter((c) => (c ?? "").trim().toUpperCase() !== code);
  if (next.length === quotes.length) {
    // 목록에 없는데 화면엔 보이는 경우 = 그 통화가 '기준 통화'로 설정돼 있다.
    // 기준 통화를 폰이 바꾸면 위젯 전체 의미가 달라지므로 웹으로 보낸다.
    const viaBase = (found.config?.base ?? "").trim().toUpperCase() === code;
    return Response.json(
      {
        error: viaBase ? "base_currency" : "not_found",
        message: viaBase
          ? "기준 통화는 웹 위젯 속성에서 바꿔 주세요."
          : "이미 삭제된 통화입니다.",
      },
      { status: viaBase ? 409 : 404, headers: NO_STORE },
    );
  }
  if (!(await saveQuotes(admin, found, device.userId, next))) {
    return Response.json(
      { error: "upstream", message: "삭제에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }
  return Response.json({ code }, { headers: NO_STORE });
}
