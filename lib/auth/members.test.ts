/**
 * 접근 허용 판정 회귀 테스트 — 게이트가 조용히 열리거나 닫히면 안 되는 지점.
 *
 * 실행: node --test lib/auth/members.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { decideAccess, normalizeEmail } from "./access.ts";

const OWNER = "taekyoleen@gmail.com";

test("관리자는 pb_members 행이 없어도 통과한다(부트스트랩)", () => {
  assert.equal(decideAccess(OWNER, OWNER, null), true);
  // 대소문자·공백이 섞여도 같은 사람으로 본다.
  assert.equal(decideAccess("  TaeKyoLeen@Gmail.com ", OWNER, null), true);
});

test("승인된 회원만 통과 — pending·blocked·미등록은 차단", () => {
  assert.equal(decideAccess("friend@example.com", OWNER, "approved"), true);
  assert.equal(decideAccess("friend@example.com", OWNER, "pending"), false);
  assert.equal(decideAccess("friend@example.com", OWNER, "blocked"), false);
  assert.equal(decideAccess("friend@example.com", OWNER, null), false);
});

test("빈 이메일·관리자 미설정은 차단(열린 채로 배포되지 않게)", () => {
  assert.equal(decideAccess("", OWNER, "approved"), false);
  assert.equal(decideAccess(null, OWNER, "approved"), false);
  assert.equal(decideAccess(undefined, OWNER, null), false);
  // ALLOWED_EMAIL 미설정(""): 아무 이메일이나 관리자로 승격되면 안 된다.
  assert.equal(decideAccess("stranger@example.com", "", null), false);
  assert.equal(decideAccess("", "", null), false);
  // 단, 이미 승인된 회원은 관리자 설정과 무관하게 유효하다.
  assert.equal(decideAccess("friend@example.com", "", "approved"), true);
});

test("normalizeEmail: trim + lowercase, null 안전", () => {
  assert.equal(normalizeEmail("  A@B.COM "), "a@b.com");
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
});
