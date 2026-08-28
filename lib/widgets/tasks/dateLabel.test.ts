/**
 * 작업 일자 표시 규칙 회귀 테스트 — 같은 연월=일만, 같은 연도=월일, 다른 연도=전체.
 * 실행: node --test lib/widgets/tasks/dateLabel.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { taskDateLabel } from "../../../components/widgets/tasks/dateLabel.ts";

const today = new Date(2026, 7, 29); // 2026-08-29 (month는 0-base)

test("같은 연도·같은 월 → 일자만", () => {
  assert.equal(taskDateLabel("2026-08-05", today), "5일");
  assert.equal(taskDateLabel("2026-08-31", today), "31일");
});

test("같은 연도, 다른 월 → 월일만", () => {
  assert.equal(taskDateLabel("2026-09-15", today), "9.15");
  assert.equal(taskDateLabel("2026-01-03", today), "1.3");
});

test("다른 연도 → 연월일 전체", () => {
  assert.equal(taskDateLabel("2027-01-05", today), "2027.1.5");
  assert.equal(taskDateLabel("2025-12-31", today), "2025.12.31");
});

test("미입력·잘못된 값 → 빈 문자열", () => {
  assert.equal(taskDateLabel(null, today), "");
  assert.equal(taskDateLabel(undefined, today), "");
  assert.equal(taskDateLabel("not-a-date", today), "");
});
