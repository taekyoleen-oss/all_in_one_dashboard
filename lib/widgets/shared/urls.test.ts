/**
 * 텍스트 → 웹주소 추출 회귀 테스트(노트 자동 링크 · 메모 링크 칩의 공통 기반).
 *
 * 실행: node --test lib/widgets/shared/urls.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/shared/*, 테스트는 test 글롭(lib/**) 안에 둔다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { findUrls, urlHost } from "../../../components/widgets/shared/urls.ts";

test("http(s) 주소와 www 주소를 찾는다", () => {
  assert.deepEqual(
    findUrls("자료 https://example.com/a?b=1 와 www.naver.com 참고").map(
      (u) => [u.text, u.href],
    ),
    [
      ["https://example.com/a?b=1", "https://example.com/a?b=1"],
      ["www.naver.com", "https://www.naver.com"],
    ],
  );
});

test("한글 조사·문장부호는 주소에 딸려오지 않는다", () => {
  assert.deepEqual(
    findUrls("https://naver.com를 보세요. http://a.co.kr, 그리고 끝").map(
      (u) => u.text,
    ),
    ["https://naver.com", "http://a.co.kr"],
  );
});

test("주소가 아니면 찾지 않는다(점 없는 호스트 포함)", () => {
  assert.deepEqual(findUrls("그냥 텍스트 https:// http://localhost:3000"), []);
});

test("start/end 로 원본을 그대로 잘라낼 수 있다(자동 링크용)", () => {
  const s = "여기 https://a.com/b 끝";
  const [u] = findUrls(s);
  assert.equal(s.slice(u.start, u.end), "https://a.com/b");
  assert.equal(s.slice(0, u.start), "여기 ");
  assert.equal(s.slice(u.end), " 끝");
});

test("호스트 라벨 — www. 는 떼고 보여준다", () => {
  assert.equal(urlHost("https://www.naver.com/news"), "naver.com");
  assert.equal(urlHost("https://news.naver.com/x"), "news.naver.com");
  assert.equal(urlHost("not a url"), "not a url");
});
