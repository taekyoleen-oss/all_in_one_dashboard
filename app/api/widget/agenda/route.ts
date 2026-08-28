/**
 * GET /api/widget/agenda?days=N — 위젯 아젠다(Bearer 디바이스 토큰).
 *
 *  KST 오늘 00:00부터 N일(기본 2, 1~7) 창의 pb_circle_appointments를 대상 이름·색과
 *  함께 내려보낸다. 시각(when_at) 또는 연기 시각(snooze_until)이 창에 든 일정만 —
 *  시각 없는 약속은 '오늘 목록'에 놓을 자리가 없어 제외한다(웹앱에서 관리).
 *
 *  ETag: 항목 JSON 해시. If-None-Match 일치 시 304(본문 없음) — 15분 폴링 비용 절감.
 */
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireDevice } from "@/lib/api/widgetDevice";
import { kstAgendaWindow, sha256Hex } from "@/lib/api/widgetCore";
import type { WidgetAgendaItem } from "@/output/api-shapes";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" } as const;

export async function GET(request: NextRequest) {
  const device = await requireDevice(request);
  if (device instanceof Response) return device;

  const daysRaw = Number(request.nextUrl.searchParams.get("days") ?? "2");
  const days = Number.isFinite(daysRaw) ? Math.min(7, Math.max(1, Math.trunc(daysRaw))) : 2;
  const { fromIso, toIso } = kstAgendaWindow(new Date(), days);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pb_circle_appointments")
    .select("id, content, when_at, status, snooze_until, target:pb_circle_targets(name, color)")
    .eq("user_id", device.userId)
    .or(
      `and(when_at.gte.${fromIso},when_at.lt.${toIso}),and(snooze_until.gte.${fromIso},snooze_until.lt.${toIso})`,
    );
  if (error) {
    return Response.json(
      { error: "upstream", message: "일정 조회에 실패했습니다." },
      { status: 502, headers: NO_STORE },
    );
  }

  const items: WidgetAgendaItem[] = (data ?? [])
    .map((row) => {
      const startAt = row.when_at ?? row.snooze_until;
      if (!startAt) return null; // or 필터상 도달 불가 — 타입 좁히기용
      return {
        id: row.id,
        title: row.content,
        targetName: row.target?.name ?? null,
        startAt,
        allDay: false,
        status: (row.status === "done" || row.status === "snoozed"
          ? row.status
          : "pending") as WidgetAgendaItem["status"],
        snoozeUntil: row.snooze_until,
        colorToken: row.target?.color ?? null,
      };
    })
    .filter((it): it is WidgetAgendaItem => it !== null)
    .sort((a, b) => {
      // 연기된 항목은 연기 시각 자리로 — 아젠다에서의 실제 등장 시점 기준 정렬.
      const at = (it: WidgetAgendaItem) =>
        Date.parse(it.status === "snoozed" && it.snoozeUntil ? it.snoozeUntil : it.startAt);
      return at(a) - at(b);
    });

  const etag = `"${sha256Hex(JSON.stringify(items)).slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...NO_STORE } });
  }
  return Response.json(
    { generatedAt: new Date().toISOString(), items },
    { headers: { etag, ...NO_STORE } },
  );
}
