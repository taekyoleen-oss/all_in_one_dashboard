/**
 * 장소 목록(최근 검색 + 즐겨찾기) 회귀 테스트.
 * 즐겨찾기가 상한 정리에 밀려 사라지거나, 다시 검색했다고 해제되면 쓸모없어진다.
 * 실행: node --test lib/widgets/route/places.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  addPlace,
  removePlace,
  toggleFavorite,
  favoritePlaces,
  recentPlaces,
  sameSpot,
  RECENT_CAP,
  type SavedPlace,
} from "./places.ts";

const p = (
  label: string,
  lat: number,
  lon: number,
  at = 0,
  fav = false,
): SavedPlace => ({ label, lat, lon, at, ...(fav ? { fav: true } : {}) });

test("추가 — 맨 앞에 오고 시각이 기록된다", () => {
  const list = addPlace([], { label: "이태원역", lat: 37.5345, lon: 126.9946 }, 1000);
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "이태원역");
  assert.equal(list[0].at, 1000);
});

test("추가 — 최근에 고른 것이 앞에 온다", () => {
  let list: SavedPlace[] = [];
  list = addPlace(list, { label: "A", lat: 37.1, lon: 127.1 }, 1);
  list = addPlace(list, { label: "B", lat: 37.2, lon: 127.2 }, 2);
  list = addPlace(list, { label: "C", lat: 37.3, lon: 127.3 }, 3);
  assert.deepEqual(list.map((x) => x.label), ["C", "B", "A"]);
});

test("추가 — 같은 지점은 중복되지 않고 맨 앞으로 올라온다", () => {
  let list = [p("A", 37.1, 127.1, 1), p("B", 37.2, 127.2, 2)];
  list = addPlace(list, { label: "A", lat: 37.1, lon: 127.1 }, 9);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((x) => x.label), ["A", "B"]);
  assert.equal(list[0].at, 9);
});

test("추가 — 좌표가 거의 같으면(≈11m 이내) 같은 곳으로 합친다", () => {
  let list = [p("남산타워", 37.5513, 126.98817, 1)];
  list = addPlace(list, { label: "N서울타워", lat: 37.55133, lon: 126.98819 }, 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].label, "N서울타워", "최근에 부른 이름이 남는다");
});

test("즐겨찾기 — 켜면 맨 위로 고정된다", () => {
  let list = [p("A", 37.1, 127.1, 3), p("B", 37.2, 127.2, 2), p("C", 37.3, 127.3, 1)];
  list = toggleFavorite(list, { lat: 37.3, lon: 127.3 });
  assert.equal(list[0].label, "C", "최근이 아니어도 즐겨찾기가 위");
  assert.equal(list[0].fav, true);
});

test("즐겨찾기 — 다시 누르면 해제된다", () => {
  let list = [p("A", 37.1, 127.1, 1, true)];
  list = toggleFavorite(list, { lat: 37.1, lon: 127.1 });
  assert.ok(!list[0].fav);
});

test("즐겨찾기 — 다시 검색해도 해제되지 않는다", () => {
  // 자주 가는 곳을 다시 검색했다고 즐겨찾기가 풀리면 곤란하다.
  let list = [p("집", 37.1, 127.1, 1, true)];
  list = addPlace(list, { label: "우리집", lat: 37.1, lon: 127.1 }, 5);
  assert.equal(list.length, 1);
  assert.equal(list[0].fav, true);
  assert.equal(list[0].label, "우리집");
});

test("즐겨찾기 — 상한 정리에서 제외된다", () => {
  // 즐겨찾기 1곳 + 최근을 상한보다 많이 채운다
  let list: SavedPlace[] = [p("집", 37.0, 127.0, 0, true)];
  for (let i = 1; i <= RECENT_CAP + 5; i++) {
    list = addPlace(list, { label: `P${i}`, lat: 37 + i * 0.01, lon: 127.5 }, i);
  }
  assert.ok(
    list.some((x) => x.label === "집" && x.fav),
    "즐겨찾기가 밀려나면 안 된다",
  );
  assert.equal(recentPlaces(list).length, RECENT_CAP);
  assert.equal(favoritePlaces(list).length, 1);
});

test("분리 — 즐겨찾기와 최근이 겹치지 않는다", () => {
  let list = [p("A", 37.1, 127.1, 2), p("B", 37.2, 127.2, 1)];
  list = toggleFavorite(list, { lat: 37.1, lon: 127.1 });
  assert.deepEqual(favoritePlaces(list).map((x) => x.label), ["A"]);
  assert.deepEqual(recentPlaces(list).map((x) => x.label), ["B"]);
});

test("추가 — 상한을 넘으면 오래된 최근 항목부터 버린다", () => {
  let list: SavedPlace[] = [];
  for (let i = 0; i < RECENT_CAP + 5; i++) {
    list = addPlace(list, { label: `P${i}`, lat: 37 + i * 0.01, lon: 127 }, i);
  }
  assert.equal(list.length, RECENT_CAP);
  assert.equal(list[0].label, `P${RECENT_CAP + 4}`);
  assert.ok(!list.some((x) => x.label === "P0"));
});

test("추가 — 이름·좌표가 없으면 담지 않는다", () => {
  const before = [p("A", 37.1, 127.1, 1)];
  assert.deepEqual(addPlace(before, { label: "", lat: 37.9, lon: 127.9 }, 2), before);
  assert.deepEqual(
    addPlace(before, { label: "X", lat: Number.NaN, lon: 127.9 }, 2),
    before,
  );
});

test("추가 — 원본 배열을 바꾸지 않는다", () => {
  const before = [p("A", 37.1, 127.1, 1)];
  const copy = [...before];
  addPlace(before, { label: "B", lat: 37.2, lon: 127.2 }, 2);
  assert.deepEqual(before, copy);
});

test("삭제 — 해당 지점만 빠진다(즐겨찾기도 지울 수 있다)", () => {
  const list = [p("A", 37.1, 127.1, 1, true), p("B", 37.2, 127.2, 2)];
  assert.deepEqual(
    removePlace(list, { lat: 37.1, lon: 127.1 }).map((x) => x.label),
    ["B"],
  );
});

test("같은 지점 판정", () => {
  assert.equal(sameSpot({ lat: 37.5, lon: 127.0 }, { lat: 37.50005, lon: 127.0 }), true);
  assert.equal(sameSpot({ lat: 37.5, lon: 127.0 }, { lat: 37.51, lon: 127.0 }), false);
});
