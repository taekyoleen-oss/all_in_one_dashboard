/**
 * 최근 검색 목록 회귀 테스트 — 중복이 쌓이거나 상한이 안 지켜지면 목록이 쓸모없어진다.
 * 실행: node --test lib/widgets/route/recent.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  addRecent,
  removeRecent,
  sameSpot,
  RECENT_CAP,
  type RecentPlace,
} from "./recent.ts";

const p = (label: string, lat: number, lon: number, at = 0): RecentPlace => ({
  label,
  lat,
  lon,
  at,
});

test("추가 — 맨 앞에 오고 시각이 기록된다", () => {
  const list = addRecent([], { label: "이태원역", lat: 37.5345, lon: 126.9946 }, 1000);
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "이태원역");
  assert.equal(list[0].at, 1000);
});

test("추가 — 최근에 고른 것이 항상 맨 앞", () => {
  let list: RecentPlace[] = [];
  list = addRecent(list, { label: "A", lat: 37.1, lon: 127.1 }, 1);
  list = addRecent(list, { label: "B", lat: 37.2, lon: 127.2 }, 2);
  list = addRecent(list, { label: "C", lat: 37.3, lon: 127.3 }, 3);
  assert.deepEqual(list.map((x) => x.label), ["C", "B", "A"]);
});

test("추가 — 같은 지점은 중복되지 않고 맨 앞으로 올라온다", () => {
  let list = [p("A", 37.1, 127.1, 1), p("B", 37.2, 127.2, 2)];
  list = addRecent(list, { label: "A", lat: 37.1, lon: 127.1 }, 9);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((x) => x.label), ["A", "B"]);
  assert.equal(list[0].at, 9);
});

test("추가 — 좌표가 거의 같으면(≈11m 이내) 같은 곳으로 합친다", () => {
  // 같은 건물 입구를 두 번 검색해 좌표가 미세하게 다른 경우.
  let list = [p("남산타워", 37.5513, 126.98817, 1)];
  list = addRecent(list, { label: "N서울타워", lat: 37.55133, lon: 126.98819 }, 2);
  assert.equal(list.length, 1);
  // 최근에 부른 이름이 남는다
  assert.equal(list[0].label, "N서울타워");
});

test("추가 — 조금 떨어진 곳은 별개로 남는다", () => {
  let list = [p("A", 37.5, 127.0, 1)];
  list = addRecent(list, { label: "B", lat: 37.502, lon: 127.0 }, 2);
  assert.equal(list.length, 2);
});

test("추가 — 상한을 넘으면 오래된 것부터 버린다", () => {
  let list: RecentPlace[] = [];
  for (let i = 0; i < RECENT_CAP + 5; i++) {
    list = addRecent(list, { label: `P${i}`, lat: 37 + i * 0.01, lon: 127 }, i);
  }
  assert.equal(list.length, RECENT_CAP);
  assert.equal(list[0].label, `P${RECENT_CAP + 4}`);
  // 가장 오래된 것들은 사라졌다
  assert.ok(!list.some((x) => x.label === "P0"));
});

test("추가 — 이름 없는 장소는 담지 않는다(목록에서 알아볼 수 없다)", () => {
  const before = [p("A", 37.1, 127.1, 1)];
  assert.deepEqual(addRecent(before, { label: "", lat: 37.9, lon: 127.9 }, 2), before);
  assert.deepEqual(addRecent(before, { label: "   ", lat: 37.9, lon: 127.9 }, 2), before);
});

test("추가 — 잘못된 좌표는 담지 않는다", () => {
  const before = [p("A", 37.1, 127.1, 1)];
  assert.deepEqual(
    addRecent(before, { label: "X", lat: Number.NaN, lon: 127.9 }, 2),
    before,
  );
});

test("추가 — 원본 배열을 바꾸지 않는다", () => {
  const before = [p("A", 37.1, 127.1, 1)];
  const copy = [...before];
  addRecent(before, { label: "B", lat: 37.2, lon: 127.2 }, 2);
  assert.deepEqual(before, copy);
});

test("삭제 — 해당 지점만 빠진다", () => {
  const list = [p("A", 37.1, 127.1, 1), p("B", 37.2, 127.2, 2)];
  const next = removeRecent(list, { lat: 37.1, lon: 127.1 });
  assert.deepEqual(next.map((x) => x.label), ["B"]);
});

test("같은 지점 판정", () => {
  assert.equal(sameSpot({ lat: 37.5, lon: 127.0 }, { lat: 37.50005, lon: 127.0 }), true);
  assert.equal(sameSpot({ lat: 37.5, lon: 127.0 }, { lat: 37.51, lon: 127.0 }), false);
});
