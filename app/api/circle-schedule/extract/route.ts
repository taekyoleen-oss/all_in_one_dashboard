/**
 * POST /api/circle-schedule/extract — 카카오톡 텍스트에서 약속 후보를 추출한다.
 *
 *  요청: JSON body { text: string } (붙여넣은 카카오톡 원문).
 *  응답: ExtractSchema { appointments: [{ content, when_at, source? }] }.
 *
 *  인증: 세션 소유자만 호출 가능(LLM 비용 남용 방지). proxy가 /api/*를 통과시키므로
 *  라우트에서 직접 getUser()로 게이트한다(card import 라우트와 동일 패턴).
 *  대상/구분은 여기서 판단하지 않는다 — 사용자가 검토 UI에서 지정한다.
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractAppointments,
  MAX_EXTRACT_CHARS,
} from "@/lib/api/circleScheduleClient";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" } as const;

export async function POST(request: NextRequest) {
  // 1) 인증 게이트 — 본인 세션만.
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return Response.json(
      { error: "unauthorized", message: "로그인이 필요합니다." },
      { status: 401, headers: noStore },
    );
  }

  // 2) 입력 파싱.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "요청 형식이 올바르지 않습니다." },
      { status: 400, headers: noStore },
    );
  }
  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json(
      { error: "empty", message: "정리할 내용을 붙여넣어 주세요." },
      { status: 400, headers: noStore },
    );
  }

  // 3) 추출.
  const result = await extractAppointments(text.slice(0, MAX_EXTRACT_CHARS));
  if (!result.ok) {
    if (result.reason === "no_key") {
      return Response.json(
        {
          error: "not_configured",
          message: "AI 추출이 아직 설정되지 않았습니다(ANTHROPIC_API_KEY).",
        },
        { status: 503, headers: noStore },
      );
    }
    if (result.reason === "parse") {
      return Response.json(
        {
          error: "parse",
          message: "결과를 처리하지 못했습니다. 다시 시도해 주세요.",
        },
        { status: 502, headers: noStore },
      );
    }
    return Response.json(
      { error: "upstream", message: "추출에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502, headers: noStore },
    );
  }

  return Response.json(result.data, { headers: noStore });
}
