/**
 * 주식 심볼 분류 회귀 테스트 — 미국 종목·ETF 추가 지원.
 *
 * 핵심 요구:
 *  - "AAPL"·"SPY" 같은 미국 티커가 국내 코드/지수와 구분되고(USD·개별종목),
 *    KIS 라우팅에서 '국내 아님'으로 분류돼 야후 폴백으로 넘어간다(isDomesticSymbol).
 *    이게 깨지면 KIS 사용 중 미국 종목이 조용히 errors로 빠져 "—"로 표시된다.
 *
 * 실행: node --test lib/api/stock/symbols.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  isDomesticSymbol,
  isUsTicker,
  resolveMeta,
  toYahooSymbol,
} from "./symbols.ts";

test("미국 티커 판별: 국내 코드·지수·한글과 겹치지 않는다", () => {
  for (const s of ["AAPL", "SPY", "QQQ", "BRK-B", "BF.B"]) {
    assert.equal(isUsTicker(s), true, s);
  }
  for (const s of ["005930", "035720.KQ", "^DJI", "^KS11", "삼성전자", ""]) {
    assert.equal(isUsTicker(s), false, s);
  }
});

test("KIS 라우팅: 국내(지수·6자리)만 KIS, 나머지는 폴백행", () => {
  for (const s of ["^KS11", "^KQ11", "005930", "035720.KQ"]) {
    assert.equal(isDomesticSymbol(s), true, s);
  }
  for (const s of ["^DJI", "^GSPC", "^IXIC", "AAPL", "SPY"]) {
    assert.equal(isDomesticSymbol(s), false, s);
  }
});

test("미국 티커 메타: USD · 개별 종목 · 티커를 이름으로", () => {
  const m = resolveMeta("SPY");
  assert.equal(m.currency, "USD");
  assert.equal(m.isIndex, false);
  assert.equal(m.name, "SPY");
  // 국내 종목은 기존대로 KRW 유지(회귀 방지).
  assert.equal(resolveMeta("005930").currency, "KRW");
});

test("야후 심볼: 미국 티커는 그대로, 국내 코드는 거래소 접미사", () => {
  assert.equal(toYahooSymbol("AAPL"), "AAPL");
  assert.equal(toYahooSymbol("005930"), "005930.KS");
  assert.equal(toYahooSymbol("035720.KQ"), "035720.KQ");
  assert.equal(toYahooSymbol("^DJI"), "^DJI");
});
