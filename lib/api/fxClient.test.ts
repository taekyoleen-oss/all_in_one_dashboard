/**
 * fxClient 전일대비 등락(상승/하락) 방향 회귀 테스트.
 *
 * 버그: 네이버 `fluctuationsRatio`는 이미 부호가 붙어 오는데(하락 시 "-0.45"), 예전
 * `signedNaverRatio`는 이를 크기로 보고 `fluctuationsType` 부호를 한 번 더 곱해
 * 하락 날에 방향이 뒤집혔다(주말엔 직전 거래일이 하락이면 모든 통화가 반대로 표시).
 *
 * 실행: node --test lib/api/fxClient.test.ts   (Node 22+ 타입 스트리핑)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { signedNaverRatio } from "./fxClient.ts";
import { fxDirectionFromPct } from "../../components/widgets/fx/format.ts";

/**
 * 화면에 표시되는 KRW-per-통화 값의 등락 방향을 서버→위젯 부호 흐름 그대로 재현한다.
 *  server.changePct = -signedNaverRatio (code-per-KRW 기준으로 반전)
 *  widget.cp        = -server.changePct  (다시 KRW-per-code 기준으로 복원)
 *  → 결국 표시 방향 = fxDirectionFromPct(signedNaverRatio)
 */
function displayedDirection(info: Parameters<typeof signedNaverRatio>[0]) {
  const serverChangePct = -signedNaverRatio(info);
  const widgetCp = -serverChangePct;
  return fxDirectionFromPct(widgetCp);
}

test("하락(FALLING): 부호 붙은 ratio여도 방향이 '하락'으로 표시된다", () => {
  // 실제 네이버 응답(2026-06-26 USD/KRW): 7원 하락, -0.45%.
  const usd = {
    closePrice: "1,538.00",
    fluctuationsRatio: "-0.45",
    fluctuationsType: { code: "5", text: "하락", name: "FALLING" },
  };
  assert.equal(signedNaverRatio(usd), -0.45); // 예전 버그에선 +0.45였음
  assert.equal(displayedDirection(usd), "down");
});

test("상승(RISING): 양수 ratio → 방향 '상승'", () => {
  const info = {
    fluctuationsRatio: "0.30",
    fluctuationsType: { name: "RISING" },
  };
  assert.equal(signedNaverRatio(info), 0.3);
  assert.equal(displayedDirection(info), "up");
});

test("ratio가 부호 없이 와도(크기만) type 부호를 따른다", () => {
  const info = {
    fluctuationsRatio: "0.45",
    fluctuationsType: { name: "FALLING" },
  };
  assert.equal(signedNaverRatio(info), -0.45);
  assert.equal(displayedDirection(info), "down");
});

test("보합(STEADY) → 0, 방향 'flat'", () => {
  const info = {
    fluctuationsRatio: "0.00",
    fluctuationsType: { name: "STEADY" },
  };
  assert.equal(signedNaverRatio(info), 0);
  assert.equal(displayedDirection(info), "flat");
});

test("등락 type을 알 수 없으면 부호 붙은 ratio를 그대로 신뢰", () => {
  const info = { fluctuationsRatio: "-0.30", fluctuationsType: undefined };
  assert.equal(signedNaverRatio(info), -0.3);
  assert.equal(displayedDirection(info), "down");
});

test("상한가(UPPER_LIMIT)/하한가(LOWER_LIMIT) 처리", () => {
  assert.equal(
    signedNaverRatio({ fluctuationsRatio: "1.20", fluctuationsType: { name: "UPPER_LIMIT" } }),
    1.2,
  );
  assert.equal(
    signedNaverRatio({ fluctuationsRatio: "-1.20", fluctuationsType: { name: "LOWER_LIMIT" } }),
    -1.2,
  );
});

test("주말 시나리오: 직전 거래일(금) 전 통화 하락 → 전부 '하락'으로 표시", () => {
  // 2026-06-26 네이버 실데이터(USD/JPY/EUR/CNY 모두 FALLING, 부호 붙은 ratio).
  const friday = [
    { code: "USD", fluctuationsRatio: "-0.45", fluctuationsType: { name: "FALLING" } },
    { code: "JPY", fluctuationsRatio: "-0.42", fluctuationsType: { name: "FALLING" } },
    { code: "EUR", fluctuationsRatio: "-0.35", fluctuationsType: { name: "FALLING" } },
    { code: "CNY", fluctuationsRatio: "-0.51", fluctuationsType: { name: "FALLING" } },
  ];
  for (const f of friday) {
    assert.equal(displayedDirection(f), "down", `${f.code} 방향`);
  }
});
