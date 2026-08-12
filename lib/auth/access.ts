/**
 * 접근 허용 판정의 **순수 규칙** — DB·Supabase import가 없는 모듈.
 *
 *  members.ts(서버 전용, service-role)에서 분리해 둔 이유는 두 가지다:
 *   1. node --test가 경로 별칭(@/…) 값 import를 못 열기 때문에 테스트 가능해야 한다.
 *   2. 게이트 규칙이 한 곳에만 있어야 한다 — 5개 진입점이 같은 판정을 쓴다.
 */

export type MemberStatus = "pending" | "approved" | "blocked";

export interface MemberRow {
  email: string;
  status: MemberStatus;
  note: string | null;
  requested_at: string;
  decided_at: string | null;
}

/** 이메일 비교·저장의 정규형 — 전 경로에서 이것만 쓴다(대소문자 중복 방지). */
export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

/** 관리자(소유자) 이메일. 미설정이면 "" — 그 경우 아무도 관리자가 되지 못한다. */
export function ownerEmail(): string {
  return normalizeEmail(process.env.ALLOWED_EMAIL);
}

export function isOwnerEmail(email?: string | null): boolean {
  const owner = ownerEmail();
  return owner !== "" && normalizeEmail(email) === owner;
}

/**
 * 이메일·관리자 이메일·DB status만으로 접근 여부를 정한다.
 *  - 관리자: pb_members에 행이 없어도 통과(부트스트랩 — 표가 비어도 안 잠긴다)
 *  - 그 외: status === "approved" 일 때만 통과
 */
export function decideAccess(
  email: string | null | undefined,
  owner: string,
  status: MemberStatus | null,
): boolean {
  const e = normalizeEmail(email);
  if (e === "") return false;
  const o = normalizeEmail(owner);
  if (o !== "" && e === o) return true;
  return status === "approved";
}
