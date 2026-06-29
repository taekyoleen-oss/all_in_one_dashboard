/**
 * 노트 접기 레이아웃 계산 회귀 테스트 — computeNoteCollapse(실제 collapseNote가 쓰는 함수).
 *
 * 핵심 요구: 더접기 시 아래 위젯이 줄어든 만큼 올라오고, 접기(복원) 시 정확히 그만큼
 * 다시 내려간다(왕복 대칭). 그리드가 자유 배치라 컴팩션에 기대지 않고 직접 이동시킨다.
 *
 * 실행: node --test lib/widgets/note/collapseLayout.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/note/collapseLayout.ts, 테스트는 test 글롭(lib/**) 안에 두어
 *    npm test로 함께 수집되게 한다(상대경로 import).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNoteCollapse,
  type Rect,
} from "../../../components/widgets/note/collapseLayout.ts";

const MIN_H = 3; // note.minSize.h

/** 보드 한 칸. */
function tile(instanceId: string, x: number, y: number, w: number, h: number): Rect {
  return { instanceId, x, y, w, h };
}
const byId = (l: Rect[], id: string) => l.find((t) => t.instanceId === id)!;

test("더접기(normal→more): 노트 h 절반 + 바로 아래 위젯이 그만큼 위로", () => {
  // 노트(0,0,8,8) 아래에 위젯 B(0,8,8,4)가 딱 붙어 있다.
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H);

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, 4); // 8 → 4
  assert.equal(res.config.collapse, "more");
  assert.equal(res.config.normalHeight, 8); // 접기 직전 높이 캡처
  assert.equal(byId(res.layout, "B").y, 4); // 8 → 4 (delta -4 만큼 위로)
  assert.deepEqual(res.movedIds, ["B"]);
});

test("접기(more→normal): normalHeight로 h 복원 + 아래 위젯이 그만큼 아래로", () => {
  // 더접기된 상태: 노트(0,0,8,4) normalHeight=8, B는 위로 올라가 y=4.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "normal",
    MIN_H,
  );

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, 8); // 4 → 8 복원
  assert.equal(res.config.collapse, "normal");
  assert.equal(byId(res.layout, "B").y, 8); // 4 → 8 (delta +4 만큼 아래로)
});

test("왕복 대칭: 더접기 → 접기 하면 노트 h·아래 위젯 y가 원래대로", () => {
  const original = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];

  const more = computeNoteCollapse(original, "note", {}, "more", MIN_H);
  const back = computeNoteCollapse(
    more.layout,
    "note",
    more.config,
    "normal",
    MIN_H,
  );

  assert.equal(byId(back.layout, "note").h, byId(original, "note").h); // 8
  assert.equal(byId(back.layout, "B").y, byId(original, "B").y); // 8
  assert.equal(byId(back.layout, "B").h, byId(original, "B").h); // 변형 없음
});

test("옆 열 위젯은 건드리지 않는다(가로 겹침 없음)", () => {
  // 노트 x0..8. C는 x8..12(가로로 안 겹침) — 같은 행이어도 '아래'가 아니라 '옆'.
  const layout = [
    tile("note", 0, 0, 8, 8),
    tile("C", 8, 2, 4, 6), // 옆 열
    tile("B", 0, 8, 8, 4), // 바로 아래
  ];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H);

  assert.equal(byId(res.layout, "C").y, 2); // 그대로
  assert.equal(byId(res.layout, "B").y, 4); // 위로
  assert.deepEqual(res.movedIds, ["B"]);
});

test("아래로 쌓인 여러 위젯은 같은 delta로 함께 이동(간격·상대위치 보존)", () => {
  // 노트(0,0,8,8) 아래 B(0,10,8,2)·C(0,14,8,2) — 노트와 B 사이 간격 2, B와 C 사이 간격 2.
  const layout = [
    tile("note", 0, 0, 8, 8),
    tile("B", 0, 10, 8, 2),
    tile("C", 0, 14, 8, 2),
  ];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H); // h 8→4, delta -4

  const B = byId(res.layout, "B");
  const C = byId(res.layout, "C");
  assert.equal(B.y, 6); // 10 → 6
  assert.equal(C.y, 10); // 14 → 10
  // 간격 보존: 노트하단(4)~B(6)=2, B하단(8)~C(10)=2.
  assert.equal(B.y - (byId(res.layout, "note").y + byId(res.layout, "note").h), 2);
  assert.equal(C.y - (B.y + B.h), 2);
});

test("minH 클램프: 절반이 minSize.h보다 작으면 minH로", () => {
  // 노트 h=4 → 절반 2지만 minH=3으로 클램프. delta = 3 - 4 = -1.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 3)];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H);

  assert.equal(byId(res.layout, "note").h, 3);
  assert.equal(byId(res.layout, "B").y, 3); // 4 → 3 (delta -1)
});

test("이미 more에서 더접기 재클릭은 no-op(1/4로 안 쪼개짐)", () => {
  // normalHeight=8, 현재 h=4(=8/2). more 재요청 → base=8, half=4 = 현재 h → 변화 없음.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "more",
    MIN_H,
  );

  assert.equal(res.changed, false);
  assert.equal(byId(res.layout, "B").y, 4); // 그대로
});

test("normal에서 접기 재클릭은 no-op", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", { collapse: "normal" }, "normal", MIN_H);
  assert.equal(res.changed, false);
});

test("가로로 일부만 겹쳐도 '아래'로 보고 이동", () => {
  // 노트 x0..8. D는 x6..14 — x겹침(6<8 && 0<14) 있음 → 아래면 이동.
  const layout = [tile("note", 0, 0, 8, 8), tile("D", 6, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H);
  assert.equal(byId(res.layout, "D").y, 4); // 이동함
  assert.deepEqual(res.movedIds, ["D"]);
});
