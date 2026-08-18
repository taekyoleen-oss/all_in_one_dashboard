/**
 * isBlankHtml 회귀 테스트 — 머리말 '삭제됨' 판정의 근거.
 *
 * 이 판정이 틀리면 두 방향 모두 나쁘다:
 *  - 내용이 있는데 비었다고 보면 → 머리말이 화면에서 사라진다.
 *  - 비었는데 아니라고 보면 → 지워도 빈 칸이 계속 남는다.
 *
 * 실행: node --test lib/widgets/note/sanitize.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/note/sanitize.ts, 테스트는 test 글롭(lib/**) 안에 둔다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isBlankHtml } from "../../../components/widgets/note/sanitize.ts";

test("빈 값·공백·빈 태그는 '비었다'", () => {
  assert.equal(isBlankHtml(""), true);
  assert.equal(isBlankHtml("   "), true);
  assert.equal(isBlankHtml("<p></p>"), true);
  assert.equal(isBlankHtml("<p><br></p>"), true);
  assert.equal(isBlankHtml("<div>\n  <p>  </p>\n</div>"), true);
});

test("글자가 있으면 '비지 않았다'", () => {
  assert.equal(isBlankHtml("<p>머리말</p>"), false);
  assert.equal(isBlankHtml("안내 문구"), false);
});

test("글자가 없어도 이미지·표·구분선만 있으면 '비지 않았다'", () => {
  // 텍스트만 보면 빈 것으로 오인해 사용자의 이미지를 숨겨버린다 — 회귀 방지.
  assert.equal(isBlankHtml('<p><img src="data:image/png;base64,AAA"></p>'), false);
  assert.equal(isBlankHtml("<table><tr><td></td></tr></table>"), false);
  assert.equal(isBlankHtml("<hr>"), false);
});
