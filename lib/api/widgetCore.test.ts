/**
 * 위젯 브리지 순수 헬퍼 회귀 테스트 — KST 시간창·연기 기본값·요청 제한·코드 형식.
 *
 * 실행: node --test lib/api/widgetCore.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  kstAgendaWindow,
  newDeviceToken,
  newPairingCode,
  nextKstMorningIso,
  pickTasksInstance,
  rateLimited,
  sha256Hex,
} from "./widgetCore.ts";

test("kstAgendaWindow: KST 자정 기준 [오늘, +days) — 서버 TZ 무관(UTC 입력)", () => {
  // 2026-08-26 09:00 KST = 2026-08-26T00:00:00Z → 창은 KST 8/26 00:00부터 2일.
  const w = kstAgendaWindow(new Date("2026-08-26T00:00:00Z"), 2);
  assert.equal(w.fromIso, "2026-08-25T15:00:00.000Z"); // = 8/26 00:00 KST
  assert.equal(w.toIso, "2026-08-27T15:00:00.000Z"); // = 8/28 00:00 KST (미포함)
});

test("kstAgendaWindow: KST 자정 직후·직전 날짜 경계", () => {
  // 00:30 KST(= 전날 15:30Z)는 그날 창, 23:59 KST도 같은 날 창.
  const early = kstAgendaWindow(new Date("2026-08-25T15:30:00Z"), 1); // 8/26 00:30 KST
  const late = kstAgendaWindow(new Date("2026-08-26T14:59:00Z"), 1); // 8/26 23:59 KST
  assert.equal(early.fromIso, late.fromIso);
  assert.equal(early.fromIso, "2026-08-25T15:00:00.000Z");
});

test("nextKstMorningIso: 다음 날 오전 9시 KST(계획서 연기 기본값)", () => {
  // 2026-08-26 15:00 KST → 2026-08-27 09:00 KST = 27일 00:00Z.
  assert.equal(nextKstMorningIso(new Date("2026-08-26T06:00:00Z")), "2026-08-27T00:00:00.000Z");
  // 자정 직전(23:59 KST)에도 '다음 날'은 하루 뒤가 맞다.
  assert.equal(nextKstMorningIso(new Date("2026-08-26T14:59:00Z")), "2026-08-27T00:00:00.000Z");
});

test("rateLimited: 한도 안 false, 초과 true, 창 밖 히트는 소멸", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimited("k", 3, 60_000, t0 + i), false);
  assert.equal(rateLimited("k", 3, 60_000, t0 + 3), true); // 4번째 = 초과
  assert.equal(rateLimited("k", 3, 60_000, t0 + 61_000), false); // 창 밖 → 리셋
});

test("pickTasksInstance: mobileSync=true 중 mobileSyncAt 최신 1개, 없으면 null", () => {
  // 미지정·잘못된 config는 건너뛴다.
  assert.equal(pickTasksInstance([]), null);
  assert.equal(pickTasksInstance([{ id: "a", config: {} }, { id: "b", config: null }]), null);
  assert.equal(pickTasksInstance([{ id: "a", config: { mobileSync: "true" } }]), null); // 문자열은 무효
  // 단일 지정.
  assert.equal(pickTasksInstance([{ id: "a", config: { mobileSync: true } }]), "a");
  // 여럿이면 마지막으로 켠(mobileSyncAt 큰) 쪽 — 켠 시각 없는 쪽(0 취급)보다 우선.
  assert.equal(
    pickTasksInstance([
      { id: "old", config: { mobileSync: true, mobileSyncAt: 1_000 } },
      { id: "new", config: { mobileSync: true, mobileSyncAt: 2_000 } },
      { id: "noAt", config: { mobileSync: true } },
    ]),
    "new",
  );
});

test("페어링 코드는 6자리 숫자, 토큰은 pbw_ 접두 + 충분한 길이·해시 고정", () => {
  for (let i = 0; i < 20; i++) assert.match(newPairingCode(), /^\d{6}$/);
  const tok = newDeviceToken();
  assert.match(tok, /^pbw_[A-Za-z0-9_-]{40,}$/);
  // sha256은 64자 hex + 결정적(같은 입력 = 같은 해시) — 토큰 대조의 기반.
  assert.match(sha256Hex(tok), /^[0-9a-f]{64}$/);
  assert.equal(sha256Hex("123456"), sha256Hex("123456"));
});
