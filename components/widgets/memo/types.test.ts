/**
 * 메모 제목 회귀 테스트 — 헤더 제목과 본문 상단 제목이 같은 config.title을 쓴다.
 *
 * 실행: node --test components/widgets/memo/types.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMO_SIZE_CLASS,
  MEMO_SIZE_CLASS_EXPANDED,
  MEMO_TITLE_CLASS,
  MEMO_TITLE_CLASS_EXPANDED,
  memoInstanceTitle,
  type MemoConfig,
  type MemoSize,
} from "./types.ts";

const base: MemoConfig = { text: "본문", color: "default", size: "md" };

test("제목이 있으면 헤더 제목으로 쓰인다(앞뒤 공백 제거)", () => {
  assert.equal(memoInstanceTitle({ ...base, title: "장보기" }), "장보기");
  assert.equal(memoInstanceTitle({ ...base, title: "  회의 메모  " }), "회의 메모");
});

test("제목이 비면 null → 프레임이 displayName('메모')로 폴백", () => {
  assert.equal(memoInstanceTitle(base), null);
  assert.equal(memoInstanceTitle({ ...base, title: "" }), null);
  assert.equal(memoInstanceTitle({ ...base, title: "   " }), null);
});

test("제목 글씨는 같은 size 버킷의 본문보다 한 단계 크다", () => {
  // 본문 sm→title sm 이 아니라 한 칸 위 크기를 쓰는지 확인(요구: 기존보다 크게).
  const sizes: MemoSize[] = ["sm", "md", "lg"];
  const rank = (cls: string) => {
    const order = ["text-xs", "text-sm", "text-base", "text-lg", "text-xl"];
    // 컨테이너 쿼리 변형(@[220px]/widget:text-…)을 뺀 기본 크기만 비교한다.
    const basePart = cls.split(" ").find((c) => c.startsWith("text-"))!;
    return order.indexOf(basePart);
  };
  for (const s of sizes) {
    assert.equal(
      rank(MEMO_TITLE_CLASS[s]),
      rank(MEMO_SIZE_CLASS[s]) + 1,
      `타일 ${s}: 제목이 본문보다 크지 않다`,
    );
    assert.equal(
      rank(MEMO_TITLE_CLASS_EXPANDED[s]),
      rank(MEMO_SIZE_CLASS_EXPANDED[s]) + 1,
      `전체보기 ${s}: 제목이 본문보다 크지 않다`,
    );
  }
});
