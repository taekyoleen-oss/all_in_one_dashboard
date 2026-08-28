/**
 * 안드로이드 위젯 브리지 — 순수 헬퍼 (토큰/코드 생성 · KST 시간창 · 요청 제한).
 *
 *  라우트가 공유하는 로직 중 앱 import가 없는 부분만 모아 node --test로 검증한다
 *  (DB 접근이 필요한 requireDevice는 lib/api/widgetDevice.ts).
 *  시간 함수는 서버 TZ와 무관하게 KST(UTC+9) 기준으로 계산한다(weatherClient 선례).
 */
import { createHash, randomBytes, randomInt } from "node:crypto";

/** 페어링 코드 유효 시간 — 5분(계획서). */
export const PAIRING_TTL_MS = 5 * 60_000;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 디바이스 토큰 원문 — 발급 응답에만 존재, DB에는 sha256 해시만 저장. */
export function newDeviceToken(): string {
  return `pbw_${randomBytes(32).toString("base64url")}`;
}

/** 6자리 숫자 페어링 코드(crypto 난수). */
export function newPairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

const KST_MS = 9 * 3_600_000;

/** `now`가 속한 KST 날짜의 자정(KST 00:00)을 UTC epoch ms로. */
function kstMidnightUtcMs(now: Date): number {
  const kst = new Date(now.getTime() + KST_MS);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_MS;
}

/** 아젠다 창 — KST 오늘 00:00부터 `days`일. [from, to) ISO(UTC). */
export function kstAgendaWindow(now: Date, days: number): { fromIso: string; toIso: string } {
  const from = kstMidnightUtcMs(now);
  return {
    fromIso: new Date(from).toISOString(),
    toIso: new Date(from + days * 86_400_000).toISOString(),
  };
}

/** 연기 기본값 — KST 다음 날 `hour`시(계획서: 다음 날 오전 9시). ISO(UTC). */
export function nextKstMorningIso(now: Date, hour = 9): string {
  const kst = new Date(now.getTime() + KST_MS);
  const ms =
    Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1, hour) - KST_MS;
  return new Date(ms).toISOString();
}

/* ── 작업(tasks) 대상 인스턴스 해석 ─────────────────────────────────────────
 * '작업' 위젯 config의 mobileSync=true 인스턴스 중 mobileSyncAt(켠 시각)이 가장
 * 최신인 1개가 모바일 홈 화면에 표시된다. 교차 인스턴스 배선 없이 config 플래그만으로
 * 단일 지정을 해석한다(여럿 켜져 있으면 마지막으로 켠 위젯이 이긴다 — UI에 안내). */
export interface TasksInstanceRow {
  id: string;
  config: unknown;
}

/** mobileSync 켜진 인스턴스 중 최신(mobileSyncAt) 1개의 id — 없으면 null. */
export function pickTasksInstance(rows: TasksInstanceRow[]): string | null {
  let bestId: string | null = null;
  let bestAt = -1;
  for (const row of rows) {
    const cfg = row.config as { mobileSync?: unknown; mobileSyncAt?: unknown } | null;
    if (cfg?.mobileSync !== true) continue;
    const at = typeof cfg.mobileSyncAt === "number" ? cfg.mobileSyncAt : 0;
    if (at >= bestAt) {
      bestAt = at;
      bestId = row.id;
    }
  }
  return bestId;
}

/* ── 요청 제한 ──────────────────────────────────────────────────────────────
 * ponytail: 인스턴스 메모리 슬라이딩 윈도우 — Vercel 다중 인스턴스 간 비공유라
 * 소프트 한도다(디바이스 몇 대 규모엔 충분). 전역 강제가 필요해지면 DB 카운터로. */
const hits = new Map<string, number[]>();

/** `key`가 `windowMs` 안에 `limit`회를 넘겼으면 true(이번 호출 포함). */
export function rateLimited(key: string, limit = 20, windowMs = 60_000, now = Date.now()): boolean {
  const cutoff = now - windowMs;
  const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 1_000) {
    // 오래된 키 정리 — 위젯 디바이스 수 규모에서 사실상 도달하지 않는 안전판.
    for (const [k, v] of hits) if (v.every((t) => t <= cutoff)) hits.delete(k);
  }
  return list.length > limit;
}
