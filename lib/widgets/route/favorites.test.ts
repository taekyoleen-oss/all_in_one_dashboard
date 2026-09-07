/**
 * 즐겨찾기 경로 회귀 테스트 — 같은 경로가 중복 저장되거나 '현재 위치' 출발이
 * 좌표로 굳으면 즐겨찾기가 쓸모없어진다.
 * 실행: node --test lib/widgets/route/favorites.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  addFavorite,
  removeFavorite,
  isFavorite,
  favoriteId,
  favoriteLabel,
  FAVORITES_CAP,
  type FavoriteRoute,
} from "./favorites.ts";

const HOME = { label: "집", lat: 37.5, lon: 127.0 };
const WORK = { label: "회사", lat: 37.51, lon: 127.02 };

test("추가 — 도착지와 시각이 기록된다", () => {
  const list = addFavorite([], HOME, WORK, false, 1000);
  assert.equal(list.length, 1);
  assert.equal(list[0].end.label, "회사");
  assert.equal(list[0].start?.label, "집");
  assert.equal(list[0].at, 1000);
});

test("추가 — '현재 위치' 출발(null)을 그대로 보존한다", () => {
  // "지금 어디에 있든 집으로"가 가장 쓸모 있는 즐겨찾기다.
  const list = addFavorite([], null, HOME, false, 1);
  assert.equal(list[0].start, null);
  assert.equal(favoriteLabel(list[0]), "현재 위치 → 집");
});

test("추가 — 같은 경로를 다시 저장해도 중복되지 않고 맨 앞으로 온다", () => {
  let list = addFavorite([], HOME, WORK, false, 1);
  list = addFavorite(list, null, HOME, false, 2);
  list = addFavorite(list, HOME, WORK, false, 9);
  assert.equal(list.length, 2);
  assert.equal(list[0].end.label, "회사");
  assert.equal(list[0].at, 9);
});

test("추가 — 좌표가 ≈11m 이내면 같은 경로로 본다", () => {
  let list = addFavorite([], HOME, WORK, false, 1);
  list = addFavorite(list, HOME, { label: "회사 정문", lat: 37.51002, lon: 127.02001 }, false, 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].end.label, "회사 정문", "최근에 부른 이름이 남는다");
});

test("추가 — 계단 회피 옵션이 다르면 별개의 즐겨찾기다", () => {
  let list = addFavorite([], HOME, WORK, false, 1);
  list = addFavorite(list, HOME, WORK, true, 2);
  assert.equal(list.length, 2);
});

test("추가 — 반대 방향은 별개다", () => {
  let list = addFavorite([], HOME, WORK, false, 1);
  list = addFavorite(list, WORK, HOME, false, 2);
  assert.equal(list.length, 2);
});

test("추가 — 상한을 넘으면 오래된 것부터 버린다", () => {
  let list: FavoriteRoute[] = [];
  for (let i = 0; i < FAVORITES_CAP + 3; i++) {
    list = addFavorite(list, HOME, { label: `P${i}`, lat: 37.5 + i * 0.01, lon: 127.1 }, false, i);
  }
  assert.equal(list.length, FAVORITES_CAP);
  assert.equal(list[0].end.label, `P${FAVORITES_CAP + 2}`);
  assert.ok(!list.some((f) => f.end.label === "P0"));
});

test("추가 — 이름·좌표가 없는 도착지는 담지 않는다", () => {
  const before = [addFavorite([], HOME, WORK, false, 1)[0]];
  assert.deepEqual(addFavorite(before, HOME, { label: "", lat: 37.9, lon: 127.9 }, false, 2), before);
  assert.deepEqual(
    addFavorite(before, HOME, { label: "X", lat: Number.NaN, lon: 127.9 }, false, 2),
    before,
  );
});

test("추가 — 원본 배열을 바꾸지 않는다", () => {
  const before = addFavorite([], HOME, WORK, false, 1);
  const copy = [...before];
  addFavorite(before, null, HOME, false, 2);
  assert.deepEqual(before, copy);
});

test("포함 여부 판정", () => {
  const list = addFavorite([], null, WORK, false, 1);
  assert.equal(isFavorite(list, null, WORK, false), true);
  assert.equal(isFavorite(list, HOME, WORK, false), false, "출발지가 다르면 다른 경로");
  assert.equal(isFavorite(list, null, WORK, true), false, "옵션이 다르면 다른 경로");
  assert.equal(isFavorite(list, null, null, false), false, "도착지 없으면 false");
});

test("삭제 — 해당 항목만 빠진다", () => {
  let list = addFavorite([], HOME, WORK, false, 1);
  list = addFavorite(list, null, HOME, false, 2);
  const id = favoriteId(HOME, WORK, false);
  const next = removeFavorite(list, id);
  assert.equal(next.length, 1);
  assert.equal(next[0].end.label, "집");
});
