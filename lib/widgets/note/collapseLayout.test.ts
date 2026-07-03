/**
 * 노트 접기 레이아웃 계산 회귀 테스트 — computeNoteCollapse(실제 collapseNote가 쓰는 함수).
 *
 * 핵심 요구:
 *  - '소제목'(more)은 목차(소제목 개수)에 딱 맞는 fit 높이(tocCollapseH)로 축소해
 *    아래 공백을 없앤다. 단 사용자 높이(base)보다 크게는 안 늘린다(넘치면 스크롤).
 *  - '제목만'(title)은 한 줄 높이. 높이가 바뀔 때 아래 위젯이 delta만큼 함께
 *    오르내린다(왕복 대칭). 그리드가 자유 배치라 컴팩션에 기대지 않고 직접 이동시킨다.
 *
 * 실행: node --test lib/widgets/note/collapseLayout.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/note/collapseLayout.ts, 테스트는 test 글롭(lib/**) 안에 두어
 *    npm test로 함께 수집되게 한다(상대경로 import).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNoteCollapse,
  tocCollapseH,
  TITLE_COLLAPSE_H,
  type Rect,
} from "../../../components/widgets/note/collapseLayout.ts";

const MIN_H = 3; // (구) minSize.h — 기존 케이스의 파라미터 회귀 유지용
const MIN_H2 = 2; // 현행 note.minSize.h ('제목만' 접기 허용 높이)

/** n개의 소제목을 가진 노트 config 조각. */
const withSections = (n: number) => ({ sections: Array.from({ length: n }) });

/** 보드 한 칸. */
function tile(instanceId: string, x: number, y: number, w: number, h: number): Rect {
  return { instanceId, x, y, w, h };
}
const byId = (l: Rect[], id: string) => l.find((t) => t.instanceId === id)!;

test("tocCollapseH: 목차 fit 높이 — 0개=3행, 3개=4행, 5개=5행", () => {
  assert.equal(tocCollapseH(0), 3); // ceil(110/54)
  assert.equal(tocCollapseH(3), 4); // ceil(194/54)
  assert.equal(tocCollapseH(5), 5); // ceil(250/54)
});

test("소제목(normal→more): 목차 fit 높이로 축소 + 아래 위젯이 그만큼 위로", () => {
  // 노트(0,0,8,10)에 소제목 3개 → fit 4행. 아래에 B(0,10,8,4).
  const layout = [tile("note", 0, 0, 8, 10), tile("B", 0, 10, 8, 4)];
  const res = computeNoteCollapse(layout, "note", withSections(3), "more", MIN_H2);

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, 4); // 10 → 4 (fit)
  assert.equal(res.config.collapse, "more");
  assert.equal(res.config.normalHeight, 10); // 펼침 복원용 캡처
  assert.equal(byId(res.layout, "B").y, 4); // 10 → 4 (delta -6 만큼 위로)
  assert.deepEqual(res.movedIds, ["B"]);
});

test("소제목: fit이 사용자 높이(base)보다 크면 안 늘림(내부 스크롤)", () => {
  // 노트 h=3인데 소제목 5개(fit 5) → base 3 유지, 아래 위젯 불변.
  const layout = [tile("note", 0, 0, 8, 3), tile("B", 0, 3, 8, 4)];
  const res = computeNoteCollapse(layout, "note", withSections(5), "more", MIN_H2);

  assert.equal(byId(res.layout, "note").h, 3); // 늘어나지 않음
  assert.equal(byId(res.layout, "B").y, 3);
  assert.deepEqual(res.movedIds, []);
});

test("소제목: 섹션 없는 노트(sections 미보유 config)도 fit(3행)으로", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H2);

  assert.equal(byId(res.layout, "note").h, 3); // fit(0) = 3
  assert.equal(byId(res.layout, "B").y, 3); // delta -5 만큼 위로
});

test("소제목(more)→펼침(normal): normalHeight로 복원 + 아래 위젯 원위치(왕복 대칭)", () => {
  const original = [tile("note", 0, 0, 8, 10), tile("B", 0, 10, 8, 4)];

  const more = computeNoteCollapse(original, "note", withSections(3), "more", MIN_H2);
  const back = computeNoteCollapse(
    more.layout,
    "note",
    { ...withSections(3), ...more.config },
    "normal",
    MIN_H2,
  );

  assert.equal(byId(back.layout, "note").h, byId(original, "note").h); // 10
  assert.equal(byId(back.layout, "B").y, byId(original, "B").y); // 10
  assert.equal(byId(back.layout, "B").h, byId(original, "B").h); // 변형 없음
});

test("이미 more에서 소제목 재클릭은 no-op(fit 높이 일치 시)", () => {
  // 소제목 3개 fit=4로 이미 접힌 상태.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { ...withSections(3), collapse: "more", normalHeight: 10 },
    "more",
    MIN_H2,
  );

  assert.equal(res.changed, false);
  assert.equal(byId(res.layout, "B").y, 4); // 그대로
});

test("normal에서 접기 재클릭은 no-op", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", { collapse: "normal" }, "normal", MIN_H);
  assert.equal(res.changed, false);
});

test("옆 열 위젯은 건드리지 않는다(가로 겹침 없음) — 제목만 접기", () => {
  // 노트 x0..8. C는 x8..12(가로로 안 겹침) — 같은 행이어도 '아래'가 아니라 '옆'.
  const layout = [
    tile("note", 0, 0, 8, 8),
    tile("C", 8, 2, 4, 6), // 옆 열
    tile("B", 0, 8, 8, 4), // 바로 아래
  ];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H2); // h 8→2, delta -6

  assert.equal(byId(res.layout, "C").y, 2); // 그대로
  assert.equal(byId(res.layout, "B").y, 2); // 위로 (8 → 2)
  assert.deepEqual(res.movedIds, ["B"]);
});

test("아래로 쌓인 여러 위젯은 같은 delta로 함께 이동(간격·상대위치 보존)", () => {
  // 노트(0,0,8,8) 아래 B(0,10,8,2)·C(0,14,8,2) — 노트와 B 사이 간격 2, B와 C 사이 간격 2.
  const layout = [
    tile("note", 0, 0, 8, 8),
    tile("B", 0, 10, 8, 2),
    tile("C", 0, 14, 8, 2),
  ];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H2); // h 8→2, delta -6

  const B = byId(res.layout, "B");
  const C = byId(res.layout, "C");
  assert.equal(B.y, 4); // 10 → 4
  assert.equal(C.y, 8); // 14 → 8
  // 간격 보존: 노트하단(2)~B(4)=2, B하단(6)~C(8)=2.
  assert.equal(B.y - (byId(res.layout, "note").y + byId(res.layout, "note").h), 2);
  assert.equal(C.y - (B.y + B.h), 2);
});

test("minH 클램프: fit/TITLE_COLLAPSE_H가 minSize.h보다 작으면 minH로", () => {
  // TITLE_COLLAPSE_H=2 < minH=3 → h는 3으로 클램프. delta = 3 - 4 = -1.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 3)];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H);

  assert.equal(byId(res.layout, "note").h, 3);
  assert.equal(byId(res.layout, "B").y, 3); // 4 → 3 (delta -1)
});

test("제목만(normal→title): 노트 h가 TITLE_COLLAPSE_H로 + 아래 위젯이 그만큼 위로", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H2);

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, TITLE_COLLAPSE_H); // 8 → 2
  assert.equal(res.config.collapse, "title");
  assert.equal(res.config.normalHeight, 8); // 접기 직전 높이 캡처
  assert.equal(byId(res.layout, "B").y, 2); // 8 → 2 (delta -6 만큼 위로)
  assert.deepEqual(res.movedIds, ["B"]);
});

test("제목만 → 펼침(normal): normalHeight로 복원 + 아래 위젯 원위치(왕복 대칭)", () => {
  const original = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];

  const title = computeNoteCollapse(original, "note", {}, "title", MIN_H2);
  const back = computeNoteCollapse(
    title.layout,
    "note",
    title.config,
    "normal",
    MIN_H2,
  );

  assert.equal(byId(back.layout, "note").h, 8);
  assert.equal(byId(back.layout, "B").y, 8);
});

test("소제목(more) → 제목만(title): 원래 높이(normalHeight) 보존", () => {
  // 소제목 fit(h=4)로 접힌 상태(normalHeight=10) → 제목만.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { ...withSections(3), collapse: "more", normalHeight: 10 },
    "title",
    MIN_H2,
  );

  assert.equal(byId(res.layout, "note").h, TITLE_COLLAPSE_H); // 4 → 2
  assert.equal(res.config.normalHeight, 10); // 원래 높이 보존
  assert.equal(byId(res.layout, "B").y, 2); // delta -2
});

test("제목만(title) → 소제목(more): 목차 fit 높이로(원래 높이는 계속 보존)", () => {
  // title 상태: h=2, normalHeight=10, 소제목 3개 → fit 4.
  const layout = [tile("note", 0, 0, 8, 2), tile("B", 0, 2, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { ...withSections(3), collapse: "title", normalHeight: 10 },
    "more",
    MIN_H2,
  );

  assert.equal(byId(res.layout, "note").h, 4); // fit(3)
  assert.equal(res.config.normalHeight, 10); // 펼침 복원용 유지
  assert.equal(byId(res.layout, "B").y, 4); // delta +2 만큼 아래로
});

test("이미 title에서 제목만 재클릭은 no-op", () => {
  const layout = [tile("note", 0, 0, 8, 2), tile("B", 0, 2, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "title", normalHeight: 8 },
    "title",
    MIN_H2,
  );
  assert.equal(res.changed, false);
  assert.equal(byId(res.layout, "B").y, 2);
});

test("가로로 일부만 겹쳐도 '아래'로 보고 이동 — 제목만 접기", () => {
  // 노트 x0..8. D는 x6..14 — x겹침(6<8 && 0<14) 있음 → 아래면 이동.
  const layout = [tile("note", 0, 0, 8, 8), tile("D", 6, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H2); // delta -6
  assert.equal(byId(res.layout, "D").y, 2); // 이동함 (8 → 2)
  assert.deepEqual(res.movedIds, ["D"]);
});
