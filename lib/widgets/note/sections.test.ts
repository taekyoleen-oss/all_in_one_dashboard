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
