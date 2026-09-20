/**
 * 노트 브리지 불변식 테스트 — 폰 편집이 서식·이미지·다른 설정을 지우지 않아야 한다.
 * 실행: node --test lib/api/widgetNote.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteSection,
  hasRichBlocks,
  htmlToPlainText,
  noteItems,
  plainTextToHtml,
  prependSection,
  sectionsOf,
  updateSection,
} from "./widgetNote.ts";

const AT = "2026-09-20T01:00:00.000Z";
const NOW = 1_800_000_000_000;

const cfg = (sections: unknown[], extra: Record<string, unknown> = {}) => ({
  title: "강의 노트",
  html: "<p>머리말입니다</p>",
  attachments: [],
  shareTarget: true,
  collapse: "more",
  sections,
  ...extra,
});

/* ── HTML ↔ 평문 ─────────────────────────────────────────────────────── */

test("블록 경계가 줄바꿈으로 살아난다", () => {
  assert.equal(htmlToPlainText("<p>첫 줄</p><p>둘째 줄</p>"), "첫 줄\n둘째 줄");
  assert.equal(htmlToPlainText("한 줄<br>다음 줄"), "한 줄\n다음 줄");
  assert.equal(htmlToPlainText("<ul><li>가</li><li>나</li></ul>"), "• 가\n• 나");
});

test("서식 태그는 벗겨도 글자는 남는다", () => {
  assert.equal(
    htmlToPlainText('<p><span style="font-weight:bold">굵게</span> 보통</p>'),
    "굵게 보통",
  );
});

test("엔티티를 제대로 되돌린다 — &amp;를 마지막에 풀어야 한다", () => {
  assert.equal(htmlToPlainText("<p>a &amp; b</p>"), "a & b");
  assert.equal(htmlToPlainText("<p>&lt;script&gt;</p>"), "<script>");
  // 원문이 "&lt;"라는 글자 그대로였던 경우가 "<"로 뭉개지면 안 된다.
  assert.equal(htmlToPlainText("<p>&amp;lt;</p>"), "&lt;");
});

test("평문 → HTML은 전부 이스케이프한다(주입 차단)", () => {
  assert.equal(
    plainTextToHtml("<script>alert(1)</script>"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  );
  assert.ok(!plainTextToHtml("a & b").includes(" & "));
});

test("평문 왕복이 안정적이다", () => {
  for (const t of ["한 줄", "첫 줄\n둘째 줄", "빈 줄\n\n뒤 문단", "a & b < c"]) {
    assert.equal(htmlToPlainText(plainTextToHtml(t)), t, t);
  }
});

test("빈 평문은 빈 HTML", () => {
  assert.equal(plainTextToHtml(""), "");
  assert.equal(plainTextToHtml("\n  \n"), "");
});

/* ── 이미지·표 보호 ──────────────────────────────────────────────────── */

test("이미지·표가 있으면 rich로 표시한다", () => {
  assert.equal(hasRichBlocks('<p>글</p><img src="data:image/png;base64,AAA">'), true);
  assert.equal(hasRichBlocks("<table><tr><td>가</td></tr></table>"), true);
  assert.equal(hasRichBlocks('<p><span style="color:red">빨강</span></p>'), false);
  assert.equal(hasRichBlocks("<ul><li>목록</li></ul>"), false);
});

test("목록 항목의 rich 플래그가 항목마다 따로 붙는다", () => {
  const items = noteItems(
    "w1",
    cfg([
      { id: "s1", title: "1주차", html: "<p>평범한 글</p>" },
      { id: "s2", title: "2주차", html: '<p>도표</p><img src="data:image/png;base64,AAA">' },
    ]),
    AT,
  );
  assert.equal(items[0].rich, false);
  assert.equal(items[1].rich, true);
  assert.equal(items[1].body, "도표"); // 이미지는 평문에 남지 않는다
});

/* ── 목록 매핑 ───────────────────────────────────────────────────────── */

test("소제목이 비면 본문 첫 줄, 그마저 없으면 '제목 없음'", () => {
  const items = noteItems(
    "w1",
    cfg([
      { id: "s1", title: "", html: "<p>본문 첫 줄</p><p>둘째</p>" },
      { id: "s2", title: "", html: "" },
    ]),
    AT,
  );
  assert.equal(items[0].title, "본문 첫 줄");
  assert.equal(items[1].title, "제목 없음");
});

test("항목은 노트 id·섹션 id·노트 제목을 함께 갖는다", () => {
  const [item] = noteItems("w9", cfg([{ id: "sec-a", title: "1주차", html: "<p>x</p>" }]), AT);
  assert.equal(item.noteId, "w9");
  assert.equal(item.sectionId, "sec-a");
  assert.equal(item.noteTitle, "강의 노트");
});

test("소제목이 없는 노트는 항목을 만들지 않는다(머리말은 메모가 아니다)", () => {
  assert.deepEqual(noteItems("w1", { title: "노트", html: "<p>머리말만</p>" }, AT), []);
});

test("깨진 sections 항목은 조용히 버린다", () => {
  const rows = sectionsOf(cfg([{ id: "ok", title: "t", html: "" }, null, "x", { title: "id 없음" }]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "ok");
});

/* ── 수정: 서식 보존 규칙 ────────────────────────────────────────────── */

test("평문이 그대로면 HTML을 다시 쓰지 않는다 — 열어만 봐도 서식이 풀리지 않게", () => {
  const rich = '<p><span style="font-weight:bold">굵은 글</span></p>';
  const next = updateSection(cfg([{ id: "s1", title: "1주차", html: rich }]), "s1", {
    title: "1주차 (수정)",
    text: htmlToPlainText(rich), // 본문은 손대지 않고 제목만 바꾼 상황
  }, NOW);
  const s = sectionsOf(next)[0];
  assert.equal(s.html, rich); // 원본 HTML 그대로
  assert.equal(s.title, "1주차 (수정)");
});

test("평문이 실제로 바뀌면 그때만 HTML을 새로 쓴다", () => {
  const next = updateSection(cfg([{ id: "s1", title: "t", html: "<p>옛 내용</p>" }]), "s1", {
    text: "새 내용",
  }, NOW);
  assert.equal(sectionsOf(next)[0].html, "<p>새 내용</p>");
});

test("수정은 다른 섹션과 노트의 다른 설정을 건드리지 않는다", () => {
  const base = cfg([
    { id: "s1", title: "1주차", html: "<p>하나</p>" },
    { id: "s2", title: "2주차", html: "<p>둘</p>" },
  ]);
  const next = updateSection(base, "s2", { text: "둘 수정" }, NOW);
  assert.equal(next.title, "강의 노트");
  assert.equal(next.html, "<p>머리말입니다</p>"); // 머리말 보존
  assert.equal(next.shareTarget, true);
  assert.equal(next.collapse, "more");
  assert.deepEqual(next.attachments, []);
  const rows = sectionsOf(next);
  assert.equal(rows[0].html, "<p>하나</p>"); // 다른 섹션 보존
  assert.equal(rows[1].html, "<p>둘 수정</p>");
});

test("모르는 섹션 id는 null(404로 옮긴다)", () => {
  assert.equal(updateSection(cfg([{ id: "s1", title: "", html: "" }]), "없음", { text: "x" }, NOW), null);
  assert.equal(deleteSection(cfg([{ id: "s1", title: "", html: "" }]), "없음"), null);
});

/* ── 추가·삭제 ───────────────────────────────────────────────────────── */

test("추가는 맨 위에 붙고 기존 섹션을 보존한다(새로 쓴 것이 위로)", () => {
  const next = prependSection(cfg([{ id: "s1", title: "1주차", html: "<p>하나</p>" }]), "s2", "2주차", "둘", NOW);
  const rows = sectionsOf(next);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "s2"); // 새 소제목이 맨 위
  assert.equal(rows[0].html, "<p>둘</p>");
  assert.equal(rows[0].updatedAt, NOW);
  assert.equal(rows[1].id, "s1"); // 기존 것은 그대로 아래에
  assert.equal(rows[1].html, "<p>하나</p>");
});

test("섹션이 없던 노트에도 추가할 수 있다", () => {
  const next = prependSection({ title: "노트", html: "<p>머리말</p>" }, "s1", "첫 소제목", "내용", NOW);
  assert.equal(sectionsOf(next).length, 1);
  assert.equal(next.html, "<p>머리말</p>"); // 머리말은 그대로
});

test("삭제는 그 섹션만 빼고 나머지를 보존한다", () => {
  const next = deleteSection(
    cfg([
      { id: "s1", title: "a", html: "<p>1</p>" },
      { id: "s2", title: "b", html: "<p>2</p>" },
    ]),
    "s1",
  );
  const rows = sectionsOf(next);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "s2");
  assert.equal(next.html, "<p>머리말입니다</p>");
});
