/**
 * 목적 프리셋 회귀 테스트 — 실측으로 고른 옵션이 조용히 뒤집히지 않도록.
 * 실행: node --test lib/widgets/route/purpose.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  PURPOSES,
  purposeOf,
  searchOptionFor,
  slopeAdjustedTime,
  stairsFixedBy,
  CLIMB_SECONDS_PER_METER,
} from "./purpose.ts";

test("일반은 '계단 피하기' 설정을 따른다", () => {
  assert.equal(searchOptionFor("walk", false), "0");
  assert.equal(searchOptionFor("walk", true), "30");
});

test("등산은 계단 회피를 켜도 추천(0)을 쓴다 — 계단 제외는 거리만 11% 늘린다(실측)", () => {
  assert.equal(searchOptionFor("hike", false), "0");
  assert.equal(searchOptionFor("hike", true), "0");
});

test("강변·해변은 계단 제외(30)를 강제한다", () => {
  assert.equal(searchOptionFor("waterside", false), "30");
  assert.equal(searchOptionFor("waterside", true), "30");
});

test("모르는 값·미설정은 일반으로 떨어진다(구버전 위젯)", () => {
  assert.equal(purposeOf(undefined).key, "walk");
  assert.equal(purposeOf(null).key, "walk");
  assert.equal(purposeOf("mountain-bike").key, "walk");
  assert.equal(searchOptionFor(undefined, true), "30");
});

test("목적이 옵션을 정하면 계단 체크박스는 무의미하다", () => {
  assert.equal(stairsFixedBy("walk"), false);
  assert.equal(stairsFixedBy("hike"), true);
  assert.equal(stairsFixedBy("waterside"), true);
});

test("보낼 수 있는 searchOption은 티맵이 받는 값뿐이다", () => {
  for (const p of PURPOSES) {
    assert.ok(
      p.searchOption === null || p.searchOption === "0" || p.searchOption === "30",
      `${p.key}: ${p.searchOption}`,
    );
  }
});

test("오르막 보정 = 네이스미스(상승 600m당 1시간)", () => {
  assert.equal(CLIMB_SECONDS_PER_METER, 6);
  // 남산 실측: 티맵 40분 + 상승 340m → 74분
  assert.equal(slopeAdjustedTime(40 * 60, 340), 40 * 60 + 340 * 6);
  assert.equal(Math.round(slopeAdjustedTime(2400, 340) / 60), 74);
});

test("상승이 없거나 값이 이상하면 원래 시간을 그대로 둔다", () => {
  assert.equal(slopeAdjustedTime(1800, 0), 1800);
  assert.equal(slopeAdjustedTime(1800, -50), 1800);
  assert.equal(slopeAdjustedTime(1800, Number.NaN), 1800);
  assert.equal(slopeAdjustedTime(Number.NaN, 100), 0);
});
