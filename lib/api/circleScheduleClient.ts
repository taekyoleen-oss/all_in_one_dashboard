/**
 * ============================================================================
 *  Circle-schedule client — 카카오톡 텍스트 → 약속 후보 추출 (Anthropic)
 * ============================================================================
 *
 *  SERVER-ONLY. `ANTHROPIC_API_KEY`로 Anthropic Messages API(`POST /v1/messages`)
 *  를 호출해 붙여넣은 카카오톡 텍스트에서 약속을 뽑아낸다. 결과는 shared 스키마
 *  (output/api-shapes.ts의 ExtractSchema)로 정규화된다.
 *
 *  - SDK 미도입: 이 저장소의 모든 외부 API(translate/KIS/weather…)와 동일하게 raw
 *    fetch를 쓴다(사용자 요구: 새 의존성 최소화). 요청은 단발 JSON이라 SDK가 불필요.
 *  - 모델: Haiku 4.5(비용·속도) — 사용자 지정. temperature 0(Haiku는 허용).
 *  - 키는 서버에서만 읽고 절대 응답/로그로 노출하지 않는다.
 *  - '오늘' 앵커는 서버에서 KST 기준으로 계산해 상대 표현("담주 토욜")을 해석하게 한다.
 */

// SERVER-ONLY: imported only from app/api/circle-schedule/extract/route.ts.
import { ExtractSchema, type Extract } from "@/output/api-shapes";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-haiku-4-5"; // 비용·속도(사용자 지정 Haiku 계열)
const MAX_TOKENS = 1024;
const FETCH_TIMEOUT_MS = 20_000;

/** 붙여넣기 입력 상한(과금·남용 방지). 넘으면 앞부분만 사용. */
export const MAX_EXTRACT_CHARS = 8000;

/** 카카오톡에서 약속만 뽑아 JSON으로 출력하도록 강제하는 시스템 프롬프트. */
const SYSTEM_PROMPT = `너는 카카오톡 대화에서 "약속/일정"을 추출하는 도우미다.
입력: 사용자가 붙여넣은 카카오톡 텍스트(대화 내보내기 원본 또는 복사한 메시지).

규칙:
- 약속·모임·행사·예약·방문·기념일 등 "만날 일/할 일"만 추출한다. 잡담·감정표현·단순 정보공유는 제외.
- content는 약속의 핵심만 아주 간결하게(명사 위주). 동사·인사·군더더기는 뺀다.
  예: "내일 엄마와 병원 갑니다" → 핵심은 "엄마와 병원", "5시에 저녁 먹으러 가자" → 핵심은 "저녁".
- 날짜/시간 표현이 있으면 content 맨 뒤에 괄호로 덧붙인다:
  · 날짜는 "M/D" 형식으로 쓴다("내일·모레·담주 토욜" 같은 상대표현은 주어진 오늘 날짜 기준으로 환산).
  · 시각이 있으면 날짜 뒤에 붙인다. 오전/오후가 문맥(아침·점심·저녁·밤·새벽·오전·오후 등)으로 분명하면 그대로 반영한다.
  · 오전/오후가 불분명한 단순 "N시"는 보통 낮 활동 시간(오전 9시~오후 8시)에 들도록 정한다: 9·10·11시→오전, 12시→낮 12시(정오), 1~8시→오후. (예: "5시"→"오후 5시", "8시"→"오후 8시", "10시"→"오전 10시".) 실제 새벽 등 예외는 사용자가 직접 수정한다.
  · 시각만 있고 날짜가 없으면 오늘 날짜(M/D)를 넣는다.
  · 날짜·시각이 전혀 없으면 괄호를 붙이지 않는다.
  예(오늘이 2026-07-01일 때):
    "내일 엄마와 병원 갑니다" → content "엄마와 병원 (7/2)"
    "5시에 저녁 먹으러 가자"  → content "저녁 (7/1 오후 5시)"
- 애매해서 날짜를 확정할 수 없으면 사용자가 쓴 표현을 그대로 괄호에 둔다.
- 정렬용 when_at(ISO8601, +09:00)을 추정할 수 있으면 채운다(시각의 오전/오후는 위 낮 시간대 기본 규칙을 따름). 없으면 null로 둔다.
- 대상/카테고리(구분)는 절대 판단하지 않는다(사용자가 직접 지정한다).

출력: 아래 JSON만 출력한다. 설명·마크다운·코드펜스 금지.
{"appointments":[{"content":"<간결한 내용 (M/D 시각)>","when_at":"<ISO 또는 null>","source":"<원본 근거 텍스트>"}]}
추출된 약속이 없으면 {"appointments":[]} 만 출력한다.`;

/** 서버 위치와 무관하게 KST(UTC+9) 기준 "YYYY-MM-DD (요일)". */
function kstTodayLabel(now: Date): string {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
  return `${y}-${m}-${d} (${dow})`;
}

/** ```json 등 코드펜스를 벗기고 첫 JSON 오브젝트만 남긴다. */
function stripToJson(raw: string): string {
  let s = raw.trim();
  // ```json ... ``` / ``` ... ``` 펜스 제거
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  // 앞뒤 잡텍스트가 있으면 첫 { ~ 마지막 } 로 클램프
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start > 0 || (end >= 0 && end < s.length - 1)) {
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
  }
  return s;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ExtractResult =
  | { ok: true; data: Extract }
  | { ok: false; reason: "no_key" | "upstream" | "parse" };

/**
 * 카카오톡 텍스트에서 약속 후보를 추출한다. 실패는 이유 코드로 반환(throw 하지 않음).
 * `now`는 KST 앵커 계산용(테스트 주입 가능).
 */
export async function extractAppointments(
  text: string,
  now: Date = new Date(),
): Promise<ExtractResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { ok: false, reason: "no_key" };

  const clipped = text.slice(0, MAX_EXTRACT_CHARS);
  const userMessage = `오늘: ${kstTodayLabel(now)}, 시간대 KST\n\n---\n${clipped}`;

  const res = await fetchWithTimeout(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res || !res.ok) return { ok: false, reason: "upstream" };

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return { ok: false, reason: "upstream" };
  }

  // Messages API 응답: { content: [{ type: "text", text }], ... }
  const blocks = (payload as { content?: Array<{ type?: string; text?: string }> })
    ?.content;
  const textOut = Array.isArray(blocks)
    ? blocks.find((b) => b?.type === "text")?.text
    : undefined;
  if (typeof textOut !== "string") return { ok: false, reason: "parse" };

  let json: unknown;
  try {
    json = JSON.parse(stripToJson(textOut));
  } catch {
    return { ok: false, reason: "parse" };
  }

  const parsed = ExtractSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "parse" };
  return { ok: true, data: parsed.data };
}
