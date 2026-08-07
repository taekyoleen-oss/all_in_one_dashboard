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
  krCode,
  mapUsSearchResults,
  resolveMeta,
  searchKrStocks,
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

test("국내 ETF 검색: '코스피100'·'KODEX'가 카탈로그에서 검색된다", () => {
  // KIND 상장법인목록엔 ETF가 없어 예전엔 0건이었다(사용자 신고: "검색되지 않습니다").
  const kospi100 = searchKrStocks("코스피100");
  assert.ok(kospi100.length > 0, "'코스피100' 검색 결과 없음");
  assert.ok(
    kospi100.some((m) => m.symbol === "237350" && m.name.includes("코스피100")),
    `KODEX 코스피100(237350) 누락: ${kospi100.map((m) => m.symbol).join(",")}`,
  );
  assert.ok(searchKrStocks("KODEX").length > 0, "'KODEX' 검색 결과 없음");
  // 개별 종목 회귀 — ETF 수천 건이 합류해도 정확히 일치하는 종목이 1순위.
  assert.equal(searchKrStocks("삼성전자")[0].symbol, "005930");
  assert.equal(searchKrStocks("005930")[0].symbol, "005930");
});

test("이름 검색에 코드 접두 매칭이 끼어들지 않는다('코스피100' → 100xxx 종목 배제)", () => {
  // 예전 로직은 질의에서 숫자만 뽑아("100") 코드가 100…인 종목을 섞어 넣었다.
  for (const m of searchKrStocks("코스피100")) {
    assert.ok(m.name.includes("코스피100"), `무관한 결과: ${m.symbol} ${m.name}`);
  }
});

test("KRX 신형 영숫자 코드(0167A0): 국내 코드로 인정 + Yahoo는 .KS, KIS 라우팅은 제외", () => {
  assert.equal(krCode("0167A0"), "0167A0");
  assert.equal(toYahooSymbol("0167A0"), "0167A0.KS"); // 실측: 시세 조회됨
  assert.equal(isUsTicker("0167A0"), false); // 숫자 시작이라 미국 티커와 무충돌
  // KIS 국내시세에서의 동작이 미확인이라 Yahoo 폴백으로 보낸다.
  assert.equal(isDomesticSymbol("0167A0"), false);
  assert.equal(isDomesticSymbol("005930"), true);
});

test("이름 검색 결과 필터: 미국 상장 주식·ETF만 남고 옵션·해외중복상장은 제외", () => {
  // 실제 Yahoo /v1/finance/search 응답에서 관찰된 항목들(q="apple", "SCHD").
  const raw = [
    { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NMS", quoteType: "EQUITY" },
    { symbol: "APC.DE", shortname: "Apple Inc.", exchange: "GER", quoteType: "EQUITY" },
    { symbol: "AAPL.BA", shortname: "APPLE INC CEDEAR", exchange: "BUE", quoteType: "EQUITY" },
    { symbol: "SCHD", shortname: "Schwab US Dividend Equity ETF", exchange: "PCX", quoteType: "ETF" },
    {
      symbol: "SCHD260918C00034000",
      shortname: "SCHD Sep 2026 34.000 call",
      exchange: "OPR",
      quoteType: "OPTION",
    },
    { symbol: "OMSIX", shortname: "Invesco Main Street Fund", exchange: "NAS", quoteType: "MUTUALFUND" },
  ];
  const out = mapUsSearchResults(raw);
  assert.deepEqual(
    out.map((r) => r.symbol),
    ["AAPL", "SCHD"],
  );
  assert.equal(out[1].type, "ETF");
  assert.equal(out[1].name, "Schwab US Dividend Equity ETF");
});

test("이름 검색 결과: 이름 없으면 심볼로, limit 준수, 빈 입력 안전", () => {
  assert.deepEqual(mapUsSearchResults(undefined), []);
  const out = mapUsSearchResults(
    [
      { symbol: "AAA", quoteType: "ETF" },
      { symbol: "BBB", longname: "Bee Corp", quoteType: "EQUITY" },
      { symbol: "CCC", quoteType: "EQUITY" },
    ],
    2,
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "AAA"); // shortname·longname 둘 다 없으면 심볼
  assert.equal(out[1].name, "Bee Corp"); // longname 우선
});

test("야후 심볼: 미국 티커는 그대로, 국내 코드는 거래소 접미사", () => {
  assert.equal(toYahooSymbol("AAPL"), "AAPL");
  assert.equal(toYahooSymbol("005930"), "005930.KS");
  assert.equal(toYahooSymbol("035720.KQ"), "035720.KQ");
  assert.equal(toYahooSymbol("^DJI"), "^DJI");
});
