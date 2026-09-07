/**
 * 다음 안내 선택 회귀 테스트 — 틀리면 크래시가 아니라 "엉뚱한 방향 안내"가 된다.
 * 실행: node --test lib/widgets/route/guidance.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { nextGuidance, turnLabel, ARRIVE_WITHIN_M } from "./guidance.ts";
import type { WalkStep } from "../../../output/api-shapes.ts";

const step = (
  index: number,
  distanceFromStart: number,
  turnType: number,
  pointType: string,
  description = "",
): WalkStep => ({
  index,
  lon: 126.99,
  lat: 37.54,
  turnType,
  description,
  name: "",
  pointType,
  distanceFromStart,
});

/** 실제 응답 모양을 축약: SP → 회전 3개 → EP, 총 1000m. */
const STEPS: WalkStep[] = [
  step(0, 0, 200, "SP", "39m 이동"),
  step(1, 120, 13, "GP", "우회전 후 150m 이동"),
  step(2, 400, 12, "GP", "좌회전 후 200m 이동"),
  step(3, 800, 211, "GP", "횡단보도 후 200m 이동"),
  step(4, 1000, 201, "EP", "도착"),
];
const TOTAL = 1000;

test("출발 직후 — 첫 회전 지점을 가리킨다(출발지는 건너뛴다)", () => {
  const g = nextGuidance(STEPS, 0, TOTAL);
  assert.equal(g.step?.index, 1);
  assert.equal(g.toStep, 120);
  assert.equal(g.toEnd, 1000);
  assert.equal(g.arrived, false);
});

test("구간 중간 — 남은 거리를 정확히 센다", () => {
  const g = nextGuidance(STEPS, 50, TOTAL);
  assert.equal(g.step?.index, 1);
  assert.equal(g.toStep, 70);
  assert.equal(g.toEnd, 950);
});

test("안내 지점 위에 서 있으면 그 지점을 계속 가리킨다(0m 앞)", () => {
  // 회전 지점을 지나치기 전에 다음 회전을 안내하면 그 회전을 놓친다.
  const g = nextGuidance(STEPS, 400, TOTAL);
  assert.equal(g.step?.index, 2);
  assert.equal(g.toStep, 0);
});

test("안내 지점을 막 지나면 다음 지점으로 넘어간다", () => {
  const g = nextGuidance(STEPS, 400.1, TOTAL);
  assert.equal(g.step?.index, 3);
  assert.ok(Math.abs(g.toStep - 399.9) < 1e-6);
});

test("마지막 회전을 지나면 안내는 없고 도착까지 거리만 남는다", () => {
  const g = nextGuidance(STEPS, 900, TOTAL);
  assert.equal(g.step, null);
  assert.equal(g.toStep, 0);
  assert.equal(g.toEnd, 100);
  assert.equal(g.arrived, false);
});

test("도착 판정 — 도착지 20m 이내", () => {
  assert.equal(nextGuidance(STEPS, 1000 - ARRIVE_WITHIN_M, TOTAL).arrived, true);
  assert.equal(nextGuidance(STEPS, 979, TOTAL).arrived, false);
  const g = nextGuidance(STEPS, 1000, TOTAL);
  assert.equal(g.arrived, true);
  assert.equal(g.step, null);
  assert.equal(g.toEnd, 0);
});

test("경로 끝 너머·음수·NaN에서도 터지지 않는다", () => {
  const over = nextGuidance(STEPS, 5000, TOTAL);
  assert.equal(over.arrived, true);
  assert.equal(over.toEnd, 0);

  const under = nextGuidance(STEPS, -50, TOTAL);
  assert.equal(under.step?.index, 1);
  assert.equal(under.toEnd, 1000);

  const nan = nextGuidance(STEPS, Number.NaN, TOTAL);
  assert.equal(nan.step?.index, 1);
  assert.ok(Number.isFinite(nan.toStep));
});

test("안내 지점이 하나도 없는 경로(직선)에서도 동작한다", () => {
  const only: WalkStep[] = [step(0, 0, 200, "SP"), step(1, 300, 201, "EP")];
  const g = nextGuidance(only, 100, 300);
  assert.equal(g.step, null);
  assert.equal(g.toEnd, 200);
  assert.equal(g.arrived, false);
});

test("남은 거리는 절대 음수가 되지 않는다", () => {
  for (const d of [-100, 0, 399, 400, 401, 999, 1000, 1e9]) {
    const g = nextGuidance(STEPS, d, TOTAL);
    assert.ok(g.toStep >= 0, `toStep ${g.toStep} at ${d}`);
    assert.ok(g.toEnd >= 0, `toEnd ${g.toEnd} at ${d}`);
  }
});

test("방향 라벨 — 실측된 코드가 모두 매핑된다", () => {
  // P0 실호출에서 실제로 관측된 turnType들(verify-tmap.mjs 출력).
  for (const t of [11, 12, 13, 17, 18, 200, 201, 211, 213]) {
    assert.equal(typeof turnLabel(t), "string", `turnType ${t}`);
  }
  assert.equal(turnLabel(12), "좌회전");
  assert.equal(turnLabel(13), "우회전");
  assert.equal(turnLabel(211), "횡단보도");
});

test("방향 라벨 — 모르는 코드는 null(호출부가 description으로 폴백)", () => {
  assert.equal(turnLabel(9999), null);
  assert.equal(turnLabel(-1), null);
});
