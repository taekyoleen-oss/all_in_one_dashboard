/**
 * 노트 소제목 섹션 순수 연산 회귀 테스트 — update/remove/move(실제 NoteEditor가 쓰는 함수).
 *
 * 핵심 요구: 변경이 없으면(모르는 id, 경계 밖 이동) 원본 배열 **참조**를 그대로 반환해
 * 호출부가 no-op 저장(디바운스 경합·낙관적 갱신 낭비)을 건너뛸 수 있어야 한다.
 *
 * 실행: node --test lib/widgets/note/sections.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/note/sections.ts, 테스트는 test 글롭(lib/**) 안에 두어
 *    npm test로 함께 수집되게 한다(상대경로 import — collapseLayout.test.ts와 동일 관례).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  createSection,
  insertIndexFor,
  insertSectionAt,
  updateSectionById,
  removeSectionById,
  moveSectionById,
} from "../../../components/widgets/note/sections.ts";
import type { NoteSection } from "../../../components/widgets/note/types.ts";

function sec(id: string, title = "", html = ""): NoteSection {
  return { id, title, html };
}
const ids = (l: NoteSection[]) => l.map((s) => s.id).join(",");

test("createSection: 빈 제목·빈 본문으로 생성", () => {
  assert.deepEqual(createSection("a"), { id: "a", title: "", html: "" });
});

test("updateSectionById: 대상만 patch 병합, 새 배열 반환, 나머지 불변", () => {
  const base = [sec("a", "A"), sec("b", "B")];
  const next = updateSectionById(base, "b", { html: "<p>x</p>", updatedAt: 123 });

  assert.notEqual(next, base);
  assert.equal(next[0], base[0]); // 비대상 요소는 같은 참조(불필요한 재생성 없음)
  assert.deepEqual(next[1], { id: "b", title: "B", html: "<p>x</p>", updatedAt: 123 });
});

test("updateSectionById: 모르는 id면 원본 참조 반환(no-op 저장 방지)", () => {
  const base = [sec("a")];
  assert.equal(updateSectionById(base, "ghost", { title: "x" }), base);
});

test("removeSectionById: 대상 제거 / 모르는 id면 원본 참조", () => {
  const base = [sec("a"), sec("b"), sec("c")];
  assert.equal(ids(removeSectionById(base, "b")), "a,c");
  assert.equal(removeSectionById(base, "ghost"), base);
});

test("moveSectionById: 아래로(+1)·위로(-1) 한 칸 교환", () => {
  const base = [sec("a"), sec("b"), sec("c")];
  assert.equal(ids(moveSectionById(base, "a", 1)), "b,a,c");
  assert.equal(ids(moveSectionById(base, "c", -1)), "a,c,b");
});

test("moveSectionById: 경계 밖(맨 위에서 위로, 맨 아래에서 아래로)·모르는 id는 원본 참조", () => {
  const base = [sec("a"), sec("b")];
  assert.equal(moveSectionById(base, "a", -1), base);
  assert.equal(moveSectionById(base, "b", 1), base);
  assert.equal(moveSectionById(base, "ghost", 1), base);
});

test("insertSectionAt: 지정 위치에 삽입, 경계 밖 index는 클램프", () => {
  const base = [sec("a"), sec("b")];
  assert.equal(ids(insertSectionAt(base, sec("n"), 0)), "n,a,b");
  assert.equal(ids(insertSectionAt(base, sec("n"), 1)), "a,n,b");
  assert.equal(ids(insertSectionAt(base, sec("n"), 2)), "a,b,n");
  // 경계 밖(음수·초과)과 빈 배열도 안전해야 한다.
  assert.equal(ids(insertSectionAt(base, sec("n"), -5)), "n,a,b");
  assert.equal(ids(insertSectionAt(base, sec("n"), 99)), "a,b,n");
  assert.equal(ids(insertSectionAt([], sec("n"), 3)), "n");
  assert.equal(base.length, 2); // 원본 불변
});

test("insertIndexFor: 활성 섹션 기준 위/아래", () => {
  const base = [sec("a"), sec("b"), sec("c")];
  assert.equal(insertIndexFor(base, "b", "above"), 1); // b 앞
  assert.equal(insertIndexFor(base, "b", "below"), 2); // b 뒤
  assert.equal(insertIndexFor(base, "a", "above"), 0);
  assert.equal(insertIndexFor(base, "c", "below"), 3);
});

test("insertIndexFor: 머리말(맨 위)·활성 없음·모르는 key면 항상 맨 앞", () => {
  // 머리말은 모든 소제목보다 위 → 그 기준의 위/아래가 모두 목록 맨 앞이다.
  // (예전엔 below가 sections.length라 "맨 아래에 생긴다"는 오동작이 있었다.)
  const base = [sec("a"), sec("b")];
  for (const key of ["__intro__", "ghost", null]) {
    assert.equal(insertIndexFor(base, key, "above"), 0, `${key} above`);
    assert.equal(insertIndexFor(base, key, "below"), 0, `${key} below`);
  }
  // 섹션이 하나도 없을 때도 0 / 0.
  assert.equal(insertIndexFor([], null, "above"), 0);
  assert.equal(insertIndexFor([], null, "below"), 0);
});

test("insertIndexFor: 마지막 섹션 기준 '아래에'는 맨 끝(append)", () => {
  const base = [sec("a"), sec("b"), sec("c")];
  assert.equal(insertIndexFor(base, "c", "below"), 3);
});
