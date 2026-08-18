/**
 * 구독 상태(구독중/해지) + 해지일 기본값 회귀 테스트.
 *
 * 해지일 기본값 = **다음 결제일**. 사용자가 준 예시를 그대로 고정한다:
 *   기준 결제일 2026-01-06, 오늘 2026-03-18 → 2026-04-06.
 *
 * 실행: node --test lib/widgets/subscriptions/compute.test.ts   (Node 22+ 타입 스트리핑)
 *  ※ 소스는 components/widgets/subscriptions/*, 테스트는 test 글롭(lib/**) 안에 둔다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultCancelDate,
  computeTotals,
  sortedForList,
} from "../../../components/widgets/subscriptions/compute.ts";
import { subStatusText } from "../../../components/widgets/subscriptions/types.ts";
import type {
  Subscription,
  SubscriptionsConfig,
} from "../../../components/widgets/subscriptions/types.ts";

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: "s1",
    name: "Netflix",
    amount: 10000,
    currency: "KRW",
    cycle: "monthly",
    anchorDate: "2026-01-06",
    active: true,
    ...over,
  };
}
const TODAY = new Date(2026, 2, 18); // 2026-03-18 (로컬 자정 기준)

test("해지일 기본값 = 다음 결제일 (2026-01-06 기준, 오늘 2026-03-18 → 2026-04-06)", () => {
  assert.equal(defaultCancelDate(sub(), TODAY), "2026-04-06");
});

test("해지일 기본값: 주기별로 다음 결제일을 따른다", () => {
  // 주간: 1/6 기준 → 3/18 이후 첫 화요일 계열 날짜(1/6 + 7*n)
  assert.equal(defaultCancelDate(sub({ cycle: "weekly" }), TODAY), "2026-03-24");
  // 연간: 1/6 기준 → 다음 해 1/6
  assert.equal(defaultCancelDate(sub({ cycle: "yearly" }), TODAY), "2027-01-06");
  // 기준일이 미래면 그 날짜가 곧 다음 결제일이다.
  assert.equal(
    defaultCancelDate(sub({ anchorDate: "2026-05-02" }), TODAY),
    "2026-05-02",
  );
});

test("해지일 기본값: 기준 날짜가 잘못되면 빈 문자열(사용자 입력)", () => {
  assert.equal(defaultCancelDate(sub({ anchorDate: "" }), TODAY), "");
  assert.equal(defaultCancelDate(sub({ anchorDate: "언젠가" }), TODAY), "");
});

test("상태 표시: 구독중 / 해지(날짜 있으면 함께)", () => {
  assert.equal(subStatusText({ active: true }), "구독중");
  assert.equal(subStatusText({ active: true, canceledAt: "2026-04-06" }), "구독중");
  assert.equal(subStatusText({ active: false }), "해지");
  assert.equal(subStatusText({ active: false, canceledAt: "   " }), "해지");
  assert.equal(
    subStatusText({ active: false, canceledAt: "2026-04-06" }),
    "해지 (2026.04.06)",
  );
});

test("합계는 구독중만 — 해지는 금액에서 빠진다", () => {
  const config: SubscriptionsConfig = {
    baseCurrency: "KRW",
    entries: [
      sub({ id: "a", amount: 10000 }),
      sub({ id: "b", amount: 5000, active: false, canceledAt: "2026-04-06" }),
    ],
  };
  const totals = computeTotals(config);
  assert.equal(totals.monthly, 10000);
  assert.equal(totals.activeCount, 1);
});

test("목록: 구독중이 먼저(결제 임박 순), 해지는 뒤(최근 해지 순)", () => {
  const config: SubscriptionsConfig = {
    baseCurrency: "KRW",
    entries: [
      sub({ id: "old-cancel", active: false, canceledAt: "2026-01-10" }),
      sub({ id: "later", anchorDate: "2026-03-28" }), // 10일 후
      sub({ id: "new-cancel", active: false, canceledAt: "2026-03-01" }),
      sub({ id: "soon", anchorDate: "2026-03-20" }), // 2일 후
    ],
  };
  assert.deepEqual(
    sortedForList(config, TODAY).map((x) => x.sub.id),
    ["soon", "later", "new-cancel", "old-cancel"],
  );
});
