/**
 * 뉴스 위젯 제목 파생 회귀 테스트 — 헤더에 설정한 검색어가 보여야 한다.
 *
 * 실행: node --test components/widgets/news/types.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { newsInstanceTitle } from "./types.ts";

test("검색어가 제목에 드러난다: 뉴스 (보험 검색)", () => {
  assert.equal(newsInstanceTitle({ query: "보험" }), "뉴스 (보험 검색)");
  assert.equal(newsInstanceTitle({ query: "속보" }), "뉴스 (속보 검색)");
  assert.equal(newsInstanceTitle({ query: "  AI  " }), "뉴스 (AI 검색)");
});

test("직접 바꾼 제목이 검색어보다 우선하고, 검색어를 바꿔도 유지된다", () => {
  assert.equal(newsInstanceTitle({ query: "보험", title: "내 뉴스" }), "내 뉴스");
  assert.equal(newsInstanceTitle({ query: "경제", title: "내 뉴스" }), "내 뉴스");
  // 제목을 비우면(공백 포함) 다시 검색어에서 파생된다.
  assert.equal(newsInstanceTitle({ query: "보험", title: "   " }), "뉴스 (보험 검색)");
});

test("검색어·제목이 모두 비면 null → 프레임이 displayName('뉴스')로 폴백", () => {
  assert.equal(newsInstanceTitle({ query: "" }), null);
  assert.equal(newsInstanceTitle({ query: "  ", title: "" }), null);
});
