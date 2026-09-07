/**
 * 고도 표시 범위 회귀 테스트 — 평지에 가까운 길이 산처럼 보이지 않아야 한다.
 * 실행: node --test lib/widgets/route/elevation.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  elevationDomain,
  elevationRatio,
  MIN_DISPLAY_SPAN_M,
  FLAT_THRESHOLD_M,
} from "./elevation.ts";
import type { WalkElevationPoint } from "../../../output/api-shapes.ts";

/** 고도 배열 → 그래프 입력(거리는 균등). */
const pts = (elevations: number[]): WalkElevationPoint[] =>
  elevations.map((elevation, i) => ({ distance: i * 10, elevation }));

/** 그래프에서 실제로 차지하는 세로 비율(0~1). */
const usedHeight = (elevations: number[]): number => {
  const d = elevationDomain(pts(elevations));
  return Math.abs(elevationRatio(d.min, d) - elevationRatio(d.max, d));
};

test("평지에 가까운 길은 그래프를 거의 채우지 않는다", () => {
  // 3m 굴곡: 예전에는 축이 3m에 맞춰져 높이를 100% 채웠다(산처럼 보임).
  const used = usedHeight([60, 61, 62, 61, 63, 62, 60]);
  assert.ok(used <= 0.2, `3m 변화가 높이의 ${(used * 100).toFixed(0)}%를 차지`);
});

test("완전한 평지도 0으로 나누지 않고 한가운데에 그려진다", () => {
  const d = elevationDomain(pts([50, 50, 50, 50]));
  assert.equal(d.range, 0);
  assert.equal(d.span, MIN_DISPLAY_SPAN_M);
  assert.ok(Math.abs(elevationRatio(50, d) - 0.5) < 1e-9, "가운데여야 한다");
  assert.equal(d.flat, true);
});

test("작은 굴곡은 위아래 여백이 고르게 붙는다(바닥에 깔리지 않음)", () => {
  const d = elevationDomain(pts([100, 104]));
  const top = elevationRatio(d.max, d);
  const bottom = elevationRatio(d.min, d);
  // 위 여백과 아래 여백이 같아야 가운데 정렬이다
  assert.ok(Math.abs(top - (1 - bottom)) < 1e-9, `${top} vs ${1 - bottom}`);
  assert.ok(top > 0.3 && bottom < 0.7);
});

test("진짜 오르막은 종전대로 그래프를 꽉 채운다", () => {
  // 이태원역 → 남산타워 실측(59m → 270m, 고저차 211m)
  const used = usedHeight([59, 80, 120, 180, 230, 270]);
  assert.ok(used > 0.99, `211m 변화가 높이의 ${(used * 100).toFixed(0)}%`);
  const d = elevationDomain(pts([59, 270]));
  assert.equal(d.domainMin, 59);
  assert.equal(d.span, 211);
});

test("하한 경계 — 정확히 하한만큼 차이나면 꽉 찬다", () => {
  const d = elevationDomain(pts([100, 100 + MIN_DISPLAY_SPAN_M]));
  assert.equal(d.span, MIN_DISPLAY_SPAN_M);
  assert.equal(d.domainMin, 100);
  assert.ok(usedHeight([100, 100 + MIN_DISPLAY_SPAN_M]) > 0.99);
});

test("평지 판정 경계", () => {
  assert.equal(elevationDomain(pts([10, 10 + FLAT_THRESHOLD_M - 0.1])).flat, true);
  assert.equal(elevationDomain(pts([10, 10 + FLAT_THRESHOLD_M])).flat, false);
});

test("누적 상승은 계속 계산된다(표시 여부는 UI가 정한다)", () => {
  const d = elevationDomain(pts([10, 20, 15, 25]));
  assert.equal(d.gain, 20); // +10, +10
});

test("비율 — 최고는 위(0), 최저는 아래(1)", () => {
  const d = elevationDomain(pts([0, 100]));
  assert.ok(Math.abs(elevationRatio(100, d) - 0) < 1e-9);
  assert.ok(Math.abs(elevationRatio(0, d) - 1) < 1e-9);
});

test("빈 입력·잘못된 값에서 터지지 않는다", () => {
  const empty = elevationDomain([]);
  assert.equal(empty.span, MIN_DISPLAY_SPAN_M);
  assert.ok(Number.isFinite(elevationRatio(0, empty)));

  const dirty = elevationDomain([
    { distance: 0, elevation: Number.NaN },
    { distance: 10, elevation: 50 },
  ]);
  assert.equal(dirty.min, 50);
  assert.equal(dirty.max, 50);
  assert.ok(Number.isFinite(dirty.domainMin));
});
