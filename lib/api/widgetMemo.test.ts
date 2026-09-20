/**
 * 메모 브리지 불변식 테스트 — 잠긴 본문 유출과 config 통째 덮어쓰기를 막는다.
 * 실행: node --test lib/api/widgetMemo.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isLockedMemo, memoRow, mergeMemoConfig } from "./widgetMemo.ts";

const AT = "2026-09-20T01:00:00.000Z";

test("잠긴 메모는 본문을 내보내지 않는다", () => {
  const row = memoRow(
    "w1",
    { title: "비밀", text: "계좌 비밀번호 1234", pwHash: "abc123" },
    AT,
  );
  assert.equal(row.locked, true);
  assert.equal(row.body, "");
  assert.equal(row.title, "비밀");
  // 본문이 어떤 형태로도 새어 나가지 않아야 한다.
  assert.ok(!JSON.stringify(row).includes("1234"));
});

test("잠기지 않은 메모는 본문을 그대로 준다", () => {
  const row = memoRow("w2", { title: "장보기", text: "우유\n계란" }, AT);
  assert.equal(row.locked, false);
  assert.equal(row.body, "우유\n계란");
});

test("pwHash가 빈 문자열·null이면 잠금이 아니다", () => {
  assert.equal(isLockedMemo({ pwHash: "" }), false);
  assert.equal(isLockedMemo({ pwHash: null }), false);
  assert.equal(isLockedMemo({}), false);
  assert.equal(isLockedMemo(null), false);
  assert.equal(isLockedMemo({ pwHash: "h" }), true);
});

test("제목이 없으면 본문 첫 줄로, 그마저 없으면 '제목 없음'", () => {
  assert.equal(memoRow("w3", { text: "첫 줄\n둘째 줄" }, AT).title, "첫 줄");
  // 앞의 빈 줄은 건너뛴다.
  assert.equal(memoRow("w4", { text: "\n\n  실제 내용" }, AT).title, "실제 내용");
  assert.equal(memoRow("w5", { text: "   " }, AT).title, "제목 없음");
  assert.equal(memoRow("w6", {}, AT).title, "제목 없음");
  // 잠긴 메모는 본문을 못 쓰므로 제목이 없으면 '제목 없음'이다.
  assert.equal(memoRow("w7", { text: "비밀 내용", pwHash: "h" }, AT).title, "제목 없음");
});

test("긴 첫 줄은 40자에서 줄인다", () => {
  const long = "가".repeat(60);
  const title = memoRow("w8", { text: long }, AT).title;
  assert.equal(title.length, 41); // 40자 + 말줄임표
  assert.ok(title.endsWith("…"));
});

test("병합은 다른 config 키를 보존한다 — 폰이 모르는 값을 지우지 않는다", () => {
  const current = {
    title: "옛 제목",
    text: "옛 본문",
    color: "amber",
    size: "lg",
    textColor: "#ef4444",
    pwHash: null,
    lockAfterMin: 30,
  };
  const next = mergeMemoConfig(current, { text: "새 본문" });
  assert.equal(next.text, "새 본문");
  assert.equal(next.title, "옛 제목"); // 주지 않은 필드는 그대로
  assert.equal(next.color, "amber");
  assert.equal(next.size, "lg");
  assert.equal(next.textColor, "#ef4444");
  assert.equal(next.lockAfterMin, 30);
  assert.ok("pwHash" in next);
});

test("병합은 원본을 변형하지 않는다", () => {
  const current = { title: "a", text: "b", color: "blue" };
  const next = mergeMemoConfig(current, { title: "c", text: "d" });
  assert.equal(current.title, "a");
  assert.equal(current.text, "b");
  assert.equal(next.title, "c");
  assert.equal(next.text, "d");
  assert.equal(next.color, "blue");
});

test("빈 config에도 병합이 동작한다(신규·손상 config)", () => {
  assert.deepEqual(mergeMemoConfig(null, { title: "새 메모" }), { title: "새 메모" });
  assert.deepEqual(mergeMemoConfig(undefined, { text: "" }), { text: "" });
});
