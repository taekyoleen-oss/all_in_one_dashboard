/**
 * 노트 접기 레이아웃 계산 회귀 테스트 — computeNoteCollapse(실제 collapseNote가 쓰는 함수).
 *
 * 핵심 요구:
 *  - '소제목'(more)은 표시 필터일 뿐 높이를 바꾸지 않는다(크기는 사용자가 정함).
 *    제목만(title)에서 전환해 올 때만 기억해 둔 높이로 복원.
 *  - '제목만'(title) 진입/이탈 시 아래 위젯이 delta만큼 함께 오르내린다(왕복 대칭).
 *    그리드가 자유 배치라 컴팩션에 기대지 않고 직접 이동시킨다.
 *
 * 실행: node --test lib/widgets/note/collapseLayout.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/note/collapseLayout.ts, 테스트는 test 글롭(lib/**) 안에 두어
 *    npm test로 함께 수집되게 한다(상대경로 import).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNoteCollapse,
  TITLE_COLLAPSE_H,
  type Rect,
} from "../../../components/widgets/note/collapseLayout.ts";

const MIN_H = 3; // (구) minSize.h — 기존 케이스의 파라미터 회귀 유지용
const MIN_H2 = 2; // 현행 note.minSize.h ('제목만' 접기 허용 높이)

/** 보드 한 칸. */
function tile(instanceId: string, x: number, y: number, w: number, h: number): Rect {
  return { instanceId, x, y, w, h };
}
const byId = (l: Rect[], id: string) => l.find((t) => t.instanceId === id)!;

test("소제목(normal→more): 높이·아래 위젯 불변 — config(collapse/normalHeight)만 갱신", () => {
  // 노트(0,0,8,8) 아래에 위젯 B(0,8,8,4)가 딱 붙어 있다.
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", {}, "more", MIN_H);

  assert.equal(res.changed, true); // 레벨 변경 자체는 저장돼야 함
  assert.equal(byId(res.layout, "note").h, 8); // 높이 자동 변경 없음
  assert.equal(res.config.collapse, "more");
  assert.equal(res.config.normalHeight, 8); // 이후 title 복원용 캡처
  assert.equal(byId(res.layout, "B").y, 8); // 아래 위젯 그대로
  assert.deepEqual(res.movedIds, []);
});

test("소제목(more)→펼침(normal): 높이 불변, 레벨만 복귀", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "normal",
    MIN_H,
  );

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, 8);
  assert.equal(res.config.collapse, "normal");
  assert.equal(byId(res.layout, "B").y, 8);
});

test("구버전 절반 높이로 저장된 more 재클릭 → 사용자 높이(normalHeight)로 self-heal", () => {
  // 과거 '절반' 동작으로 h=4(normalHeight=8)로 저장된 노트 — 소제목 재클릭 시 8로 복원.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "more",
    MIN_H,
  );

  assert.equal(res.changed, true);
  assert.equal(byId(res.layout, "note").h, 8); // 4 → 8 복원
  assert.equal(byId(res.layout, "B").y, 8); // delta +4 만큼 아래로
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

test("minH 클램프: TITLE_COLLAPSE_H가 minSize.h보다 작으면 minH로", () => {
  // TITLE_COLLAPSE_H=2 < minH=3 → h는 3으로 클램프. delta = 3 - 4 = -1.
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 3)];
  const res = computeNoteCollapse(layout, "note", {}, "title", MIN_H);

  assert.equal(byId(res.layout, "note").h, 3);
  assert.equal(byId(res.layout, "B").y, 3); // 4 → 3 (delta -1)
});

test("이미 more에서 소제목 재클릭은 no-op(높이 일치 시)", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "more",
    MIN_H,
  );

  assert.equal(res.changed, false);
  assert.equal(byId(res.layout, "B").y, 8); // 그대로
});

test("normal에서 접기 재클릭은 no-op", () => {
  const layout = [tile("note", 0, 0, 8, 8), tile("B", 0, 8, 8, 4)];
  const res = computeNoteCollapse(layout, "note", { collapse: "normal" }, "normal", MIN_H);
  assert.equal(res.changed, false);
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
  // (구버전 절반 높이 h=4로 저장된 more 상태도 동일하게 동작해야 함)
  const layout = [tile("note", 0, 0, 8, 4), tile("B", 0, 4, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "more", normalHeight: 8 },
    "title",
    MIN_H2,
  );

  assert.equal(byId(res.layout, "note").h, TITLE_COLLAPSE_H); // 4 → 2
  assert.equal(res.config.normalHeight, 8); // 원래 높이 보존
  assert.equal(byId(res.layout, "B").y, 2); // delta -2
});

test("제목만(title) → 소제목(more): normalHeight로 복원(자동 절반 없음)", () => {
  // title 상태: h=2, normalHeight=8.
  const layout = [tile("note", 0, 0, 8, 2), tile("B", 0, 2, 8, 4)];
  const res = computeNoteCollapse(
    layout,
    "note",
    { collapse: "title", normalHeight: 8 },
    "more",
    MIN_H2,
  );

  assert.equal(byId(res.layout, "note").h, 8); // 2 → 8 (절반 4가 아님)
  assert.equal(res.config.normalHeight, 8);
  assert.equal(byId(res.layout, "B").y, 8); // delta +6 만큼 아래로
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
