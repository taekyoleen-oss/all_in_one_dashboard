/**
 * 데이터 라우트 공용 인증 게이트 (SERVER-ONLY).
 *
 *  proxy(=middleware)는 페이지만 보호하고 /api/*는 통과시키므로, 유료 upstream
 *  (KMA·Kakao·KIS·DeepL 등)을 프록시하는 데이터 라우트는 핸들러 진입부에서 직접
 *  세션을 확인해야 한다(circle-schedule/extract와 동일 패턴).
 *
 *  사용법:
 *    const gate = await requireUser();
 *    if (gate) return gate;           // 401 JSON (스트림/업스트림 호출 전에)
 *
 *  401 응답은 각 라우트의 기존 에러 봉투와 같은 { error, message } shape이며
 *  no-store로 캐시되지 않는다. 위젯은 same-origin fetch(쿠키 자동 포함)라
 *  로그인 상태에선 그대로 통과한다.
 */

import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "cache-control": "no-store" } as const;

/** 세션이 없으면 401 Response를, 있으면 null을 반환한다. */
export async function requireUser(): Promise<Response | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return Response.json(
      { error: "unauthorized", message: "로그인이 필요합니다." },
      { status: 401, headers: NO_STORE },
    );
  }
  return null;
}
